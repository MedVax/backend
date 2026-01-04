import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { UserType } from 'generated/prisma/enums';
import { MailService } from 'src/mail/services/mail.service';
import { UserCreatedEvent } from '../events/user-created.event';
import { FRONTEND_URL } from 'constants/env.constant';
import { capitalizeSentence } from 'types/index.types';
import { USER_CREATED } from '../constants/user-event.constant';

@Injectable()
export class UserCreatedListener {
  constructor(private mailService: MailService) {}

  @OnEvent(USER_CREATED)
  private async handleUserCreatedEvent(data: UserCreatedEvent) {
    this.handleCreatedUser(data);
  }

  async handleCreatedUser(data: UserCreatedEvent) {
    const { user, password } = data;
    const loginUrl = FRONTEND_URL + '/signin';

    // switch (user?.type) {
    //   case UserType.USER:
    //     this.mailService.accountCreated({
    //       context: {
    //         password,
    //         loginUrl: loginUrl,
    //         email: user?.email,
    //         orgName: capitalizeSentence(user?.organization?.name || ''),
    //         userType: 'Organization User',
    //         firstName: capitalizeSentence(user?.firstName),
    //       },
    //       to: [user?.email],
    //     });
    //     break;

    //   case UserType.ADMIN:
    //     this.mailService.accountCreated({
    //       context: {
    //         password,
    //         loginUrl: loginUrl,
    //         email: user?.email,
    //         orgName: 'Fraudspect',
    //         userType: 'Admin',
    //         firstName: capitalizeSentence(user?.firstName),
    //       },
    //       to: [user?.email],
    //     });
    //     break;

    //   case UserType.SUPER_ADMIN:
    //     this.mailService.accountCreated({
    //       context: {
    //         password,
    //         loginUrl: loginUrl,
    //         email: user?.email,
    //         orgName: 'Fraudspect',
    //         userType: 'Super Admin',
    //         firstName: capitalizeSentence(user?.firstName),
    //       },
    //       to: [user?.email],
    //     });
    //     break;

    //   default:
    //     break;
    // }
  }
}
