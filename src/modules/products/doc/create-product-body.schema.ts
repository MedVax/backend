export const CreateProductBodySchema = {
  schema: {
    type: 'object',
    required: ['name', 'sku', 'price'],
    properties: {
      name: { type: 'string', example: 'Emergency Contraceptive' },
      sku: { type: 'string', example: 'EC-001' },
      description: {
        type: 'string',
        example: 'Single dose emergency contraceptive',
      },
      price: { type: 'number', example: 4500 },
      currency: { type: 'string', example: 'NGN', default: 'NGN' },
      requiresPrescription: { type: 'boolean', example: false },
      productType: {
        type: 'string',
        enum: ['OTC', 'POM'],
        example: 'OTC',
      },
      categoryId: { type: 'string', example: 'category-uuid' },
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
