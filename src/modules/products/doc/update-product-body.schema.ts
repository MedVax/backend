export const UpdateProductBodySchema = {
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      sku: { type: 'string' },
      description: { type: 'string' },
      brand: { type: 'string' },
      price: { type: 'number' },
      currency: { type: 'string' },
      requiresPrescription: { type: 'boolean' },
      productType: { type: 'string', enum: ['OTC', 'POM'] },
      categoryId: { type: 'string' },
      dosages: {
        type: 'array',
        items: { type: 'string' },
        description: 'Available dosages for this product',
      },
      packageSizes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Available package sizes for this product',
      },
      images: {
        type: 'array',
        items: {
          type: 'string',
          format: 'binary',
        },
        description:
          'Product images. If uploaded, these will be added to existing images. Can also pass image URLs in the images array as strings.',
      },
      howToUse: {
        type: 'string',
        description: 'Instructions on how to use this product',
      },
      ingredients: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of active ingredients in this product',
      },
      pharmacyAdvise: {
        type: 'string',
        description: 'Pharmacy advice or warnings for this product',
      },
      specification: {
        type: 'string',
        description: 'Product specifications and technical details',
      },
    },
  },
  required: false,
};
