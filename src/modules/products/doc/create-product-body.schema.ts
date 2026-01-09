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
      brand: { type: 'string', example: 'Pfizer' },
      price: { type: 'number', example: 4500 },
      currency: { type: 'string', example: 'NGN', default: 'NGN' },
      requiresPrescription: { type: 'boolean', example: false },
      productType: {
        type: 'string',
        enum: ['OTC', 'POM'],
        example: 'OTC',
      },
      categoryId: { type: 'string', example: 'category-uuid' },
      dosages: {
        type: 'array',
        items: { type: 'string' },
        example: ['500mg', '1000mg', '250mg'],
        description: 'Available dosages for this product',
      },
      packageSizes: {
        type: 'array',
        items: { type: 'string' },
        example: ['10 tablets', '20 tablets', '30 tablets'],
        description: 'Available package sizes for this product',
      },
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
