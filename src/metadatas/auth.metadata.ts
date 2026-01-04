import { SetMetadata, applyDecorators } from '@nestjs/common';

export const Auth = ({
  allow = false,
  guards,
  types,
}: { allow?: boolean; guards?: string[]; types?: string[] } = {}) =>
  applyDecorators(
    SetMetadata('allow', allow),
    SetMetadata('types', types || []),
    SetMetadata('guards', guards || []),
  );
