export const populateRole = {
  userRoles: {
    select: {
      role: {
        select: {
          id: true,
          name: true,
          permissions: {
            select: {
              permission: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  value: true,
                },
              },
            },
          },
        },
      },
    },
  },
};
