export const CreateCategoryBodySchema = {
  schema: {
    type: 'object',
    required: ['name', 'slug'],
    properties: {
      name: { type: 'string', example: 'Contraceptives' },
      description: { type: 'string', example: 'Contraceptive products' },
      slug: { type: 'string', example: 'contraceptives' },
      parentId: {
        type: 'string',
        example: 'parent-category-uuid',
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
};
