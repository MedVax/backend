import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  CompleteMultipartUploadCommandOutput,
  DeleteObjectCommandInput,
  DeleteObjectCommandOutput,
  ListObjectsV2CommandInput,
  ListObjectsV2CommandOutput,
  PutObjectCommandInput,
  S3,
  S3Client,
} from '@aws-sdk/client-s3';
import * as env from 'constants/env.constant';
import { Upload } from '@aws-sdk/lib-storage';

@Injectable()
export class DigitalOceanService {
  private s3Client: S3Client;
  private s3: S3;

  constructor() {
    this.s3Client = new S3Client({
      endpoint: env.DO_SPACES_ENDPOINT, // Find your endpoint in the control panel, under Settings. Prepend "https://".
      forcePathStyle: false, // Configures to use subdomain/virtual calling format.
      region: 'us-east-1', // Must be "us-east-1" when creating new Spaces. Otherwise, use the region in your endpoint (for example, nyc3).
      credentials: {
        accessKeyId: env.DO_SPACES_KEY, // Access key pair. You can create access key pairs using the control panel or API.
        secretAccessKey: env.DO_SPACES_SECRET, // Secret access key defined through an environment variable.
      },
    });
    this.s3 = new S3({
      endpoint: env.DO_SPACES_ENDPOINT, // Find your endpoint in the control panel, under Settings. Prepend "https://".
      forcePathStyle: false, // Configures to use subdomain/virtual calling format.
      region: 'us-east-1', // Must be "us-east-1" when creating new Spaces. Otherwise, use the region in your endpoint (for example, nyc3).
      credentials: {
        accessKeyId: env.DO_SPACES_KEY, // Access key pair. You can create access key pairs using the control panel or API.
        secretAccessKey: env.DO_SPACES_SECRET, // Secret access key defined through an environment variable.
      },
    });
  }
  private logger = new Logger(this.constructor.name);

  async uploadFile(
    buffer: Buffer,
    filename: string,
    extraArgs?: Pick<
      PutObjectCommandInput,
      'ContentType' | 'CacheControl' | 'Metadata'
    >,
  ): Promise<CompleteMultipartUploadCommandOutput> {
    const params = {
      Bucket: env.DO_SPACES_BUCKET, // The path to the directory you want to upload the object to, starting with your Space name.
      Key: filename, // Object key, referenced whenever you want to access this file later.
      Body: buffer, // The object's contents. This variable is an object, not a string.
      ACL: 'public-read',
      'x-amz-acl': 'public-read', // Defines ACL permissions, such as private or public.
      ...extraArgs,
    };

    try {
      const parallelUploads3 = new Upload({
        client: this.s3Client,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        params,
        queueSize: 4, // optional concurrency configuration
      });

      const data = await parallelUploads3.done();
      this.logger.log(
        `Successfully uploaded object: ' + ${params.Bucket} + '/' + ${params.Key}`,
      );
      return data;
    } catch (err: any) {
      console.log(err);
      this.logger.error(`error uploading asset: ' ${err}`);
      throw new BadRequestException('Failed to upload');
    }
  }

  async fetchObjects(
    args: Omit<ListObjectsV2CommandInput, 'Bucket'>,
  ): Promise<ListObjectsV2CommandOutput> {
    const params: ListObjectsV2CommandInput = {
      Bucket: env.DO_SPACES_BUCKET,
      ...args,
    };
    let objects;
    try {
      objects = await this.s3.listObjectsV2(params);
    } catch (err) {
      this.logger.error(`error fetching object: ' ${err}`);
      throw new BadRequestException('Error fetching Assets');
    }
    return objects;
  }

  async deleteObject(
    args: Omit<DeleteObjectCommandInput, 'Bucket'>,
  ): Promise<DeleteObjectCommandOutput> {
    const params: DeleteObjectCommandInput = {
      Bucket: env.DO_SPACES_BUCKET,
      ...args,
    };
    let object;
    try {
      object = await this.s3.deleteObject(params);
    } catch (err) {
      this.logger.error(`error deleting object: ' ${err}`);
      throw new BadRequestException('Failed to Delete');
    }
    return object;
  }
}
