import { QueryFilter, QuerySchema } from '../types';
import { Operator } from '../enums';
import { cast } from '../utils';
import { PrismaOperator } from './enums';

export function buildFilter<T>(
  filter: QueryFilter<T>,
  schema?: QuerySchema<T>,
  config?: QuerySchema<T>[Extract<keyof T, string>],
) {
  if (!filter) {
    return undefined;
  }

  const normalizedFilter = {} as NormalizedQueryFilter<T>;

  for (const field in filter) {
    const [normalizedField, normalizedValue] = buildFilterField(
      field,
      filter[field as keyof typeof filter],
      schema,
      config,
    );

    normalizedFilter[normalizedField as keyof typeof normalizedFilter] =
      normalizedValue;
  }

  return normalizedFilter;
}

export function buildFilterField<T>(
  field: string,
  value: any,
  schema?: QuerySchema<T>,
  config?: QuerySchema<T>[Extract<keyof T, string>],
) {
  const [newField, newValue] = [field, cast(value)];

  switch (newField) {
    case Operator.$and:
    case Operator.$or: {
      return [
        PrismaOperator[newField],
        newValue.map((filter: any) =>
          buildFilter(cast(filter), schema, config),
        ),
      ] as const;
    }
    case Operator.$nor: {
      return [
        PrismaOperator.$not,
        {
          [PrismaOperator.$or]: newValue.map((filter: any) =>
            buildFilter(cast(filter), schema, config),
          ),
        },
      ] as const;
    }
    case Operator.$some:
    case Operator.$every:
    case Operator.$none: {
      return [
        PrismaOperator[newField],
        buildFilter(newValue, schema, config),
      ] as const;
    }
    case Operator.$arraySome:
    case Operator.$arrayEvery:
    case Operator.$arrayNone: {
      return [PrismaOperator[newField], newValue.map(cast)] as const;
    }
    case Operator.$not: {
      return [
        PrismaOperator.$ne,
        typeof newValue === 'object'
          ? buildFilter(newValue, schema)
          : { [PrismaOperator.$eq]: newValue },
      ] as const;
    }
    case Operator.$ne: {
      return [PrismaOperator.$ne, { [PrismaOperator.$eq]: newValue }] as const;
    }
    case Operator.$nin:
    case Operator.$in: {
      return [PrismaOperator[newField], newValue.map(cast)] as const;
    }
    case Operator.$eq:
    case Operator.$lt:
    case Operator.$lte:
    case Operator.$gt:
    case Operator.$gte: {
      return [PrismaOperator[newField], newValue] as const;
    }
    case Operator.$literal: {
      return [PrismaOperator[newField], value] as const;
    }
    case Operator.$literalObject: {
      return [PrismaOperator[newField], newValue] as const;
    }
    case Operator.$literalString: {
      return [
        PrismaOperator[newField],
        typeof newValue === 'object'
          ? JSON.stringify(newValue)
          : String(newValue),
      ] as const;
    }
    case Operator.$literalNumber: {
      return [PrismaOperator[newField], Number(newValue)] as const;
    }
    default: {
      const config = schema ? schema[newField] : undefined;

      return [
        newField,
        typeof newValue === 'object' && newValue
          ? buildFilter(cast(newValue), config?.schema, config as never)
          : newValue,
      ];
      // return [
      //   newField,
      //   newValue &&
      //   typeof newValue === 'object' &&
      //   !Array.isArray(newValue) &&
      //   Object.keys(newValue).every(
      //     (key) =>
      //       !!Operator[key] &&
      //       ![Operator.$and, Operator.$or].includes(key as any),
      //   )
      //     ? buildFilter(newValue, schema)
      //     : newValue,
      // ] as const;
    }
  }
}

export default buildFilter;

export type NormalizedQueryFilter<T = object> = {
  [K in keyof T]: string | number | RegExp;
} & {
  [O in Extract<
    (typeof PrismaOperator)[keyof typeof PrismaOperator],
    '$and' | '$or' | '$nor'
  >]: {
    [K in keyof T]: string | number | RegExp;
  }[];
};
