import { PutObjectCommandInput } from '@aws-sdk/client-s3';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DigitalOceanService } from 'modules/services/digital-ocean.service';
import { ImageOptimizationService } from 'src/services/image-optimization.service';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly digitalOceanService: DigitalOceanService,
    private readonly imageOptimizationService: ImageOptimizationService,
  ) {}

  /**
   * Initialize and start upload
   * @param file Buffer
   * @param fileName string
   * @param extraArgs Optional metadata including ContentType
   * @param optimizeImage Whether to optimize image (default: true for images)
   * @returns string URL of uploaded file
   */
  async initialize(
    file: Buffer,
    fileName: string,
    extraArgs?: Pick<
      PutObjectCommandInput,
      'ContentType' | 'CacheControl' | 'Metadata'
    >,
    optimizeImage: boolean = true,
  ): Promise<string> {
    let finalBuffer = file;
    let finalContentType = extraArgs?.ContentType || 'application/octet-stream';
    let finalFileName = fileName;

    // Optimize image if it's an image and optimization is enabled
    if (
      optimizeImage &&
      this.imageOptimizationService.isImage(finalContentType)
    ) {
      try {
        if (
          this.imageOptimizationService.shouldOptimize(file, finalContentType)
        ) {
          const optimalFormat =
            this.imageOptimizationService.getOptimalFormat(finalContentType);
          const optimized = await this.imageOptimizationService.optimizeImage(
            file,
            {
              format: optimalFormat,
              maxWidth: 1920,
              maxHeight: 1920,
              quality: 85,
              effort: 4, // Balanced performance (0-6, lower = faster)
            },
          );

          // Update buffer and content type
          finalBuffer = optimized.buffer;
          finalContentType = optimized.mimeType;

          // Update file extension if format changed
          if (optimized.format !== 'original') {
            const baseName = fileName.replace(/\.[^/.]+$/, '');
            finalFileName = `${baseName}.${optimized.format}`;
          }

          this.logger.log(
            `Image optimized: ${file.length} bytes -> ${optimized.buffer.length} bytes (${((1 - optimized.buffer.length / file.length) * 100).toFixed(1)}% reduction)`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Image optimization failed, using original: ${error.message}`,
        );
        // Continue with original file if optimization fails
      }
    }

    const image = await this.digitalOceanService.uploadFile(
      finalBuffer,
      finalFileName,
      {
        ...extraArgs,
        ContentType: finalContentType,
      },
    );

    if (!image?.Location) {
      throw new BadRequestException('Upload failed!');
    }

    return image?.Location;
  }

  /**
   * Initialize many and start upload
   * @param files Array of files with buffer and fileName
   * @param optimizeImages Whether to optimize images (default: true)
   */
  async initializeMany(
    files: { file: Buffer; fileName: string; contentType?: string }[],
    optimizeImages: boolean = true,
  ): Promise<string[]> {
    const images = [];

    for (const file of files) {
      const image = await this.initialize(
        file?.file,
        file?.fileName,
        file.contentType ? { ContentType: file.contentType } : undefined,
        optimizeImages,
      );
      images.push(image);
    }

    return images;
  }

  async getManyByPrefix(prefix: string) {
    const objectsResponse = await this.digitalOceanService.fetchObjects({
      Prefix: prefix,
    });
    return objectsResponse;
  }

  /**
   * Delete asset using the key e.g if a file was uploaded as /example-folder/test-file.pdf
   * then the key in this case is /example-folder/test-file.pdf
   */
  async delete(key: string) {
    const objectResponse = await this.digitalOceanService.deleteObject({
      Key: key,
    });
    return objectResponse;
  }
}
