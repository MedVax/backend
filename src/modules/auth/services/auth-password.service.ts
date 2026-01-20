import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { UserPasswordChangeDto } from '../dtos/user-password-change.dto';
import { UserPasswordResetDto } from '../dtos/user-password-reset.dto';
import { TokenPurpose, TokenService } from 'src/helpers/token.service';
import { MailService } from 'src/mail/services/mail.service';
import { FRONTEND_URL } from 'constants/env.constant';
import { capitalizeSentence } from 'types/index.types';
import UserService from 'modules/user/services/user.service';
import { BcryptService } from 'services/bcrypt.service';

@Injectable()
export class AuthPasswordService {
  constructor(
    private prismaService: PrismaService,
    private tokenService: TokenService,
    private mailService: MailService,
    private userService: UserService,
    private bcryptService: BcryptService,
  ) {}

  private logger = new Logger(this.constructor.name);

  async change(userId: string, dto: UserPasswordChangeDto) {
    const user = await this.prismaService.user.findFirstOrThrow({
      where: { id: userId },
      omit: { password: false },
    });

    if (!this.bcryptService.compareSync(dto.oldPassword, user.password)) {
      throw new BadRequestException(`Invalid password`);
    }

    if (this.bcryptService.compareSync(dto.newPassword, user.password)) {
      throw new BadRequestException(`New password is the same as the previous`);
    }

    const password = this.bcryptService.hashSync(dto.newPassword);

    await this.prismaService.user.update({
      where: { id: userId },
      data: { password },
    });

    return null;
  }

  async forgot(email: string) {
    const user = await this.userService.findOne(email);
    if (!user) {
      this.logger.error(`couldn't send password reset  to ${email}`);
      return user;
    }

    const token = await this.tokenService.generateToken({
      payload: { email: user?.email },
      purpose: TokenPurpose.PasswordReset,
    });

    this.logger.log(`${email} forgot password`);

    this.mailService.forgotPassword({
      context: {
        firstName: capitalizeSentence(user?.firstName),
        forgotPasswordLink: `${FRONTEND_URL}/password-reset?token=${token}`,
      },
      to: [user?.email],
    });

    return null;
  }

  async reset(dto: UserPasswordResetDto) {
    const { token, newPassword } = dto;

    const tokenData = await this.tokenService.verifyToken({
      token,
      purpose: TokenPurpose.PasswordReset,
    });

    if (!tokenData?.payload?.email)
      throw new BadRequestException('Invalid token');

    const user = await this.userService.findOneOrThrow(
      tokenData?.payload?.email,
    );

    await this.prismaService.user.update({
      where: { id: user?.id },
      data: {
        password: this.bcryptService.hashSync(newPassword),
      },
    });

    this.tokenService.delete({ token, purpose: TokenPurpose.PasswordReset });
    this.mailService.forgotPasswordSuccessful({
      context: { firstName: user?.firstName },
      to: [user?.email],
    });

    return null;
  }
}
