import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';
import { ImageOptimizationService } from 'src/services/image-optimization.service';

@Module({
  controllers: [UploadsController],
  providers: [UploadsService, ImageOptimizationService],
  exports: [UploadsService, ImageOptimizationService],
})
export class UploadsModule {}
