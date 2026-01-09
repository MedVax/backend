export const ReplaceProductBodySchema = {
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
          'Product images. If uploaded, these will replace existing images. Can also pass image URLs in the images array as strings to replace all images.',
      },
      replaceImages: {
        type: 'boolean',
        description:
          'If true and files/images are provided, existing images will be replaced. If false, new images will be added.',
        default: true,
      },
    },
  },
  required: false,
};
