import { createBuilder } from 'libs/url-to-db-query/prisma';

const sessionUrlToPrismaQueryBuilder = createBuilder({
  schema: {
    id: { searchable: true },
    status: { searchable: true },
    sessionType: { searchable: true },
    scheduledDate: { searchable: true },
    scheduledDateString: { searchable: true },
    meetingId: { searchable: true },
    meetingUrl: { searchable: true },
    clientTimezone: { searchable: true },
    note: { searchable: true },
    rescheduled: { searchable: true },
    paidBy: { searchable: true },
    subscriptionId: { searchable: true },
    giftId: { searchable: true },
    hmoId: { searchable: true },
    hmoNumber: { searchable: true },
    createdAt: { searchable: true },
    updatedAt: { searchable: true },
    deleted: { searchable: true },
    deletedAt: { searchable: true },
    client: {
      type: 'relation',
      expand: true,
      schema: {
        id: { expand: true },
        clientId: { expand: true },
      },
    },
    consultant: {
      type: 'relation',
      expand: true,
      schema: {
        id: { expand: true },
        consultantId: { expand: true },
      },
    },
    subscription: {
      type: 'relation',
      expand: true,
      schema: {
        id: { expand: true },
        subscriptionId: { expand: true },
      },
    },
    gift: {
      type: 'relation',
      expand: true,
      schema: {
        id: { expand: true },
        giftId: { expand: true },
      },
    },
  },
});

export default sessionUrlToPrismaQueryBuilder;
