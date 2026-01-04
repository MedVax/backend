import { Module } from '@nestjs/common';
import { PermissionsService } from './services/permissions.service';
import { PermissionsController } from './controllers/permissions.controller';

const providers = [PermissionsService];

@Module({
  imports: [],
  controllers: [PermissionsController],
  providers: [...providers],
  exports: [...providers],
})
export class PermissionsModule {}
