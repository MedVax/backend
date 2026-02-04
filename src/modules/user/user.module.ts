import { Module, OnModuleInit } from '@nestjs/common';

import UserService from './services/user.service';
import { UserCreatedListener } from './listeners/user-created.listeners';
import { UserController } from './controllers/user.controller';
import UserSeedService from './services/user-seed.service';
import { UploadsModule } from 'src/uploads/uploads.module';

const providers = [UserService, UserSeedService];

const listeners = [UserCreatedListener];

@Module({
  imports: [UploadsModule],
  controllers: [UserController],
  providers: [...providers, ...listeners],
  exports: [...providers],
})
export class UserModule implements OnModuleInit {
  async onModuleInit() {}
}
