import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { ResponseOk } from 'src/classes/response-ok';

export const ApiResponseOk = <TModel extends Type<any>>(model: TModel) => {
  return applyDecorators(
    ApiExtraModels(ResponseOk, model),
    ApiOkResponse({
      description: 'Successfully retrieved data.',
      schema: {
        allOf: [
          { $ref: getSchemaPath(ResponseOk) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
            },
            required: [],
          },
        ],
      },
    }),
  );
};
