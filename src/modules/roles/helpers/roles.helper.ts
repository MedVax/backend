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
