import { PermissionEnum } from '../enums/permissions.enum';

export function formatPermission(value: PermissionEnum) {
  const words = value.split('_'); // Split by '_'
  const name = words
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' '); // Capitalize words
  const group =
    words[words.length - 1].charAt(0) +
    words[words.length - 1].slice(1).toLowerCase(); // Last word as group
  const description = `Allows ${name.toLowerCase()}`; // Dynamic description

  return { name, value, description, group };
}

// const beforeTransformation = [
//   {
//     name: 'Create Product',
//     value: PermissionEnum.CREATE_PRODUCT,
//     description: 'Allows creating a product',
//     group: 'Product',
//   },
//   {
//     name: 'Edit Product',
//     value: PermissionEnum.EDIT_PRODUCT,
//     description: 'Allows editing a product',
//     group: 'Product',
//   },
//   {
//     name: 'Delete Product',
//     value: PermissionEnum.DELETE_PRODUCT,
//     description: 'Allows deleting a product',
//     group: 'Product',
//   },
//   {
//     name: 'View Orders',
//     value: PermissionEnum.VIEW_ORDERS,
//     description: 'Allows viewing orders',
//     group: 'Orders',
//   },
//   {
//     name: 'Manage Users',
//     value: PermissionEnum.MANAGE_USERS,
//     description: 'Allows managing users',
//     group: 'User',
//   },
// ];

// const afterTransformation = [
//   {
//     name: 'Create Product',
//     value: 'CREATE_PRODUCT',
//     description: 'Allows create product',
//     group: 'Product',
//   },
//   {
//     name: 'Edit Product',
//     value: 'EDIT_PRODUCT',
//     description: 'Allows edit product',
//     group: 'Product',
//   },
//   {
//     name: 'Delete Product',
//     value: 'DELETE_PRODUCT',
//     description: 'Allows delete product',
//     group: 'Product',
//   },
//   {
//     name: 'View Orders',
//     value: 'VIEW_ORDERS',
//     description: 'Allows view orders',
//     group: 'Orders',
//   },
//   {
//     name: 'Manage Users',
//     value: 'MANAGE_USERS',
//     description: 'Allows manage users',
//     group: 'Users',
//   },
// ];
