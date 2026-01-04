import { Module, OnModuleInit } from '@nestjs/common';
import { RolesService } from './services/roles.service';
import { RolesController } from './controllers/roles.controller';
import UserService from 'modules/user/services/user.service';

const providers = [RolesService, UserService];

@Module({
  imports: [],
  controllers: [RolesController],
  providers: [...providers],
  exports: [...providers],
})
export class RolesModule implements OnModuleInit {
  async onModuleInit() {}
}
