export const UploadSingleImageBodySchema = {
  schema: {
    type: 'object',
    properties: {
      image: {
        type: 'string',
        format: 'binary',
        description: 'Product image (max 2MB)',
      },
    },
  },
};
