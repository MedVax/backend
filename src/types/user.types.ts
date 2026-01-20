// import { User } from '@prisma/client';

import { User } from 'generated/prisma/client';

// export type UserWithoutPassword = Pick<User, Exclude<keyof User, 'password'>>;

export type AuthUserType = User & {
  activeProfile?: {
    id: string;
    type: string;
    userProfileClient?: string;
    userProfileConsultant?: string;
  };
};
