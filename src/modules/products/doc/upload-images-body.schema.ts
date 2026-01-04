export const UploadImagesBodySchema = {
  schema: {
    type: 'object',
    properties: {
      images: {
        type: 'array',
        items: {
          type: 'string',
          format: 'binary',
        },
        description: 'Product images (max 2MB each, max 10 images)',
      },
    },
  },
};
