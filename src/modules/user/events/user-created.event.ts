import type { Prisma } from 'generated/prisma/client';

export class UserCreatedEvent {
  constructor(
    public user: Prisma.UserGetPayload<{
      include: {
        userRoles: true;
      };
    }>,
    public password: string,
  ) {}
}

// export class UsersCreatedEvent {
//   constructor(public users: UserWithoutPassword[]) {}
// }
