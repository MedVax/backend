import { Injectable } from '@nestjs/common';

import { MailService } from 'src/mail/services/mail.service';

@Injectable()
export class UserCreatedListener {
  constructor(private mailService: MailService) {}

  // @OnEvent(USER_CREATED)
  // async handleUserCreatedEvent(data: UserCreatedEvent) {
  //   this.handleCreatedUser(data);
  // }

  // async handleCreatedUser(data: UserCreatedEvent) {
  //   const { user, password } = data;
  //   const loginUrl = FRONTEND_URL + '/signin';

  //   // switch (user?.type) {
  //   //   case UserType.USER:
  //   //     this.mailService.accountCreated({
  //   //       context: {
  //   //         password,
  //   //         loginUrl: loginUrl,
  //   //         email: user?.email,
  //   //         orgName: capitalizeSentence(user?.organization?.name || ''),
  //   //         userType: 'Organization User',
  //   //         firstName: capitalizeSentence(user?.firstName),
  //   //       },
  //   //       to: [user?.email],
  //   //     });
  //   //     break;

  //   //   case UserType.ADMIN:
  //   //     this.mailService.accountCreated({
  //   //       context: {
  //   //         password,
  //   //         loginUrl: loginUrl,
  //   //         email: user?.email,
  //   //         orgName: 'Fraudspect',
  //   //         userType: 'Admin',
  //   //         firstName: capitalizeSentence(user?.firstName),
  //   //       },
  //   //       to: [user?.email],
  //   //     });
  //   //     break;

  //   //   case UserType.SUPER_ADMIN:
  //   //     this.mailService.accountCreated({
  //   //       context: {
  //   //         password,
  //   //         loginUrl: loginUrl,
  //   //         email: user?.email,
  //   //         orgName: 'Fraudspect',
  //   //         userType: 'Super Admin',
  //   //         firstName: capitalizeSentence(user?.firstName),
  //   //       },
  //   //       to: [user?.email],
  //   //     });
  //   //     break;

  //   //   default:
  //   //     break;
  //   // }
  // }
}
