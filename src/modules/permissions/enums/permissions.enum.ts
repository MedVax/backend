export enum PermissionEnum {
  // Roles
  VIEW_ROLES = 'VIEW_ROLES',
  CREATE_ROLES = 'CREATE_ROLES',
  EDIT_ROLES = 'EDIT_ROLES',
  DELETE_ROLES = 'DELETE_ROLES',

  // Users
  VIEW_USERS = 'VIEW_USERS',
  CREATE_USERS = 'CREATE_USERS',
  EDIT_USERS = 'EDIT_USERS',

  // Bypass
  ALL_ACCESS = 'ALL_ACCESS',
}

export enum PermissionMatchModeEnum {
  EVERY = 'every',
  SOME = 'some',
  NONE = 'none',
}
