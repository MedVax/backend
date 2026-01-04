import type { Prisma } from 'generated/prisma/client';

export type UserExpanded = Prisma.UserGetPayload<{
  include: {
    userRoles: {
      select: {
        role: {
          select: {
            id: true;
            name: true;
            permissions: {
              select: {
                permission: {
                  select: {
                    value: true;
                  };
                };
              };
            };
          };
        };
      };
    };
  };
}>;
