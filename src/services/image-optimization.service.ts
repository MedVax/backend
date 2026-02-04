import { Injectable, Logger } from '@nestjs/common';
import * as sharp from 'sharp';

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 1-100 for WebP
  format?: 'webp' | 'jpeg' | 'png';
  progressive?: boolean; // For JPEG
  effort?: number; // 0-6 for WebP, higher = better compression but slower (default: 4 for better performance)
}

export interface OptimizedImageResult {
  buffer: Buffer;
  mimeType: string;
  size: number;
  originalSize: number;
  format: string;
  width?: number;
  height?: number;
}

@Injectable()
export class ImageOptimizationService {
  private readonly logger = new Logger(ImageOptimizationService.name);

  // Default optimization settings
  private readonly DEFAULT_MAX_WIDTH = 1920;
  private readonly DEFAULT_MAX_HEIGHT = 1920;
  private readonly DEFAULT_QUALITY = 85; // Good balance between quality and file size
  private readonly DEFAULT_EFFORT = 4; // Balanced performance (0-6, lower = faster)
  private readonly MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
  private readonly MAX_PROCESSING_TIME = 5000; // 5 seconds timeout

  /**
   * Optimize image: resize, compress, and convert to WebP
   */
  async optimizeImage(
    buffer: Buffer,
    options: ImageOptimizationOptions = {},
  ): Promise<OptimizedImageResult> {
    const originalSize = buffer.length;
    const {
      maxWidth = this.DEFAULT_MAX_WIDTH,
      maxHeight = this.DEFAULT_MAX_HEIGHT,
      quality = this.DEFAULT_QUALITY,
      format = 'webp',
      progressive = true,
      effort = this.DEFAULT_EFFORT, // Use balanced effort for better performance
    } = options;

    try {
      // Get image metadata
      const metadata = await sharp(buffer).metadata();
      const originalWidth = metadata.width || 0;
      const originalHeight = metadata.height || 0;

      // Determine if resizing is needed
      const needsResize =
        originalWidth > maxWidth || originalHeight > maxHeight;

      // Start with the image buffer
      let pipeline = sharp(buffer);

      // Resize if needed (maintain aspect ratio)
      if (needsResize) {
        pipeline = pipeline.resize(maxWidth, maxHeight, {
          fit: 'inside', // Maintain aspect ratio, fit within dimensions
          withoutEnlargement: true, // Don't enlarge if smaller
        });
      }

      // Apply format-specific optimizations
      let optimizedBuffer: Buffer;
      let mimeType: string;
      let finalFormat: string;

      // Process image with timeout protection
      const processingPromise = (async () => {
        switch (format) {
          case 'webp':
            return await pipeline
              .webp({
                quality,
                effort, // Use configurable effort (default: 4 for better performance)
                smartSubsample: true, // Better quality
              })
              .toBuffer();
          case 'jpeg':
            return await pipeline
              .jpeg({
                quality,
                progressive,
                mozjpeg: true, // Use mozjpeg for better compression
              })
              .toBuffer();
          case 'png':
            return await pipeline
              .png({
                quality,
                compressionLevel: 9, // 0-9, higher = better compression
                adaptiveFiltering: true,
              })
              .toBuffer();
          default:
            // Default to WebP
            return await pipeline
              .webp({
                quality,
                effort,
              })
              .toBuffer();
        }
      })();

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Image processing timeout')),
          this.MAX_PROCESSING_TIME,
        ),
      );

      optimizedBuffer = await Promise.race([processingPromise, timeoutPromise]);

      // Set format-specific values
      switch (format) {
        case 'webp':
          mimeType = 'image/webp';
          finalFormat = 'webp';
          break;
        case 'jpeg':
          mimeType = 'image/jpeg';
          finalFormat = 'jpeg';
          break;
        case 'png':
          mimeType = 'image/png';
          finalFormat = 'png';
          break;
        default:
          mimeType = 'image/webp';
          finalFormat = 'webp';
      }

      // Get final dimensions
      const finalMetadata = await sharp(optimizedBuffer).metadata();

      // If still too large, apply more aggressive compression
      if (optimizedBuffer.length > this.MAX_FILE_SIZE && format === 'webp') {
        this.logger.warn(
          `Image still too large after optimization (${optimizedBuffer.length} bytes). Applying aggressive compression.`,
        );
        optimizedBuffer = await sharp(buffer)
          .resize(maxWidth, maxHeight, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({
            quality: Math.max(60, quality - 20), // Reduce quality further
            effort: effort, // Keep same effort level
          })
          .toBuffer();
      }

      const compressionRatio =
        ((originalSize - optimizedBuffer.length) / originalSize) * 100;

      this.logger.log(
        `Image optimized: ${originalSize} bytes -> ${optimizedBuffer.length} bytes (${compressionRatio.toFixed(1)}% reduction)`,
      );

      return {
        buffer: optimizedBuffer,
        mimeType,
        size: optimizedBuffer.length,
        originalSize,
        format: finalFormat,
        width: finalMetadata.width,
        height: finalMetadata.height,
      };
    } catch (error) {
      this.logger.error(
        `Failed to optimize image: ${error.message}`,
        error.stack,
      );
      // Return original buffer if optimization fails
      return {
        buffer,
        mimeType: 'image/jpeg', // Fallback
        size: buffer.length,
        originalSize: buffer.length,
        format: 'original',
      };
    }
  }

  /**
   * Optimize image and convert to WebP (convenience method)
   */
  async optimizeToWebP(
    buffer: Buffer,
    options: Omit<ImageOptimizationOptions, 'format'> = {},
  ): Promise<OptimizedImageResult> {
    return this.optimizeImage(buffer, {
      ...options,
      format: 'webp',
    });
  }

  /**
   * Check if file is an image that can be optimized
   */
  isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  /**
   * Check if image should be optimized (not already WebP or too small)
   */
  shouldOptimize(
    buffer: Buffer,
    mimeType: string,
    minSizeToOptimize: number = 50 * 1024, // 50KB
  ): boolean {
    // Don't optimize if already WebP and small
    if (mimeType === 'image/webp' && buffer.length < minSizeToOptimize) {
      return false;
    }

    // Optimize if it's an image
    return this.isImage(mimeType);
  }

  /**
   * Get optimal format based on image type
   */
  getOptimalFormat(mimeType: string): 'webp' | 'jpeg' | 'png' {
    // For photos/realistic images, use WebP
    if (
      mimeType === 'image/jpeg' ||
      mimeType === 'image/jpg' ||
      mimeType === 'image/webp'
    ) {
      return 'webp';
    }

    // For images with transparency, keep PNG or convert to WebP (WebP supports transparency)
    if (mimeType === 'image/png' || mimeType === 'image/gif') {
      return 'webp'; // WebP supports transparency
    }

    // Default to WebP
    return 'webp';
  }
}
