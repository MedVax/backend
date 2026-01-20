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
