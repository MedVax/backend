export const UpdateCategoryBodySchema = {
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      slug: { type: 'string' },
      parentId: {
        type: 'string',
        description: 'Parent category ID for subcategories',
      },
      image: {
        type: 'string',
        format: 'binary',
        description:
          'Category image (max 2MB). Allowed types: JPEG, PNG, WebP, GIF',
      },
    },
  },
  required: false,
};
