import { createBuilder } from 'libs/url-to-db-query/prisma';

const transactionUrlToPrismaQueryBuilder = createBuilder({
  schema: {
    id: { searchable: true },
    userId: { searchable: true },
    type: { searchable: true },
    reference: { searchable: true },
    providerReference: { searchable: true },
    provider: { searchable: true },
    status: { searchable: true },
    amount: { searchable: true },
    currency: { searchable: true },
    description: { searchable: true },
    orderId: { searchable: true },
    sessionId: { searchable: true },
    paymentMethod: { searchable: true },
    paymentChannel: { searchable: true },
    authorizationCode: { searchable: true },
    customerCode: { searchable: true },
    customerEmail: { searchable: true },
    customerName: { searchable: true },
    webhookEvent: { searchable: true },
    errorMessage: { searchable: true },
    errorCode: { searchable: true },
    initiatedAt: { searchable: true },
    completedAt: { searchable: true },
    failedAt: { searchable: true },
    refundedAt: { searchable: true },
    createdAt: { searchable: true },
    updatedAt: { searchable: true },
    user: {
      type: 'relation',
      expand: true,
      schema: {
        id: { expand: true },
        email: { expand: true },
      },
    },
    order: {
      type: 'relation',
      expand: true,
      schema: {
        id: { expand: true },
        orderId: { expand: true },
      },
    },
    session: {
      type: 'relation',
      expand: true,
      schema: {
        id: { expand: true },
        sessionId: { expand: true },
      },
    },
  },
});

export default transactionUrlToPrismaQueryBuilder;
