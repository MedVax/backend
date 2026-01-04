export const UpdateProductBodySchema = {
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      sku: { type: 'string' },
      description: { type: 'string' },
      price: { type: 'number' },
      currency: { type: 'string' },
      requiresPrescription: { type: 'boolean' },
      productType: { type: 'string', enum: ['OTC', 'POM'] },
      categoryId: { type: 'string' },
      images: {
        type: 'array',
        items: {
          type: 'string',
          format: 'binary',
        },
        description:
          'Product images. If uploaded, these will be added to existing images. Can also pass image URLs in the images array as strings.',
      },
    },
  },
  required: false,
};
