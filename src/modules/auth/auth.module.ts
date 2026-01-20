import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { AuthPasswordService } from './services/auth-password.service';
import { AuthController } from './controllers/auth.controller';
import { AuthPasswordController } from './controllers/auth-password.controller';
import { UserModule } from 'modules/user/user.module';
import { RolesService } from 'modules/roles/services/roles.service';
import { CartModule } from 'modules/cart/cart.module';

const providers = [AuthService, AuthPasswordService, RolesService];

@Module({
  imports: [UserModule, forwardRef(() => CartModule)],
  controllers: [AuthController, AuthPasswordController],
  providers: [...providers],
  exports: [...providers],
})
export class AuthModule {}
