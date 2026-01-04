import { PutObjectCommandInput } from '@aws-sdk/client-s3';
import { BadRequestException, Injectable } from '@nestjs/common';
import { DigitalOceanService } from 'modules/services/digital-ocean.service';

@Injectable()
export class UploadsService {
  constructor(private readonly digitalOceanService: DigitalOceanService) {}

  /**
   * Initialize and start upload
   * @param file Buffer
   * @param fileName string
   * @returns string
   */
  async initialize(
    file: Buffer,
    fileName: string,
    extraArgs?: Pick<
      PutObjectCommandInput,
      'ContentType' | 'CacheControl' | 'Metadata'
    >,
  ): Promise<string> {
    const image = await this.digitalOceanService.uploadFile(
      file,
      fileName,
      extraArgs,
    );

    if (!image?.Location) {
      throw new BadRequestException('Upload failed!');
    }

    return image?.Location;
  }

  /**
   * Initialize many and start upload
   */
  async initializeMany(
    files: { file: Buffer; fileName: string }[],
  ): Promise<string[]> {
    const images = [];

    for (const file of files) {
      const image = await this.initialize(file?.file, file?.fileName);
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
