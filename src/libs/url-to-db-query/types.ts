export type QueryFilter<T> = {
  [K in keyof QueryFilterFields<T>]?: QueryFilterFields<T>[K];
} & { [K in QueryOperator]?: QueryFilter<T>[] };

export type QueryFilterFields<T> = {
  [K in keyof Partial<T>]?: QueryFilterValue<Partial<T>[K]>;
};

export type QueryFilterValue<V> =
  | V
  | {
      [O in Exclude<Operator, '$and' | '$or' | '$nor'>]?: O extends '$not'
        ? QueryFilterValue<V>
        : V | (string | number)[] | Record<string, any>;
    }
  //   | {
  //       [O in Extract<Operator, '$and' | '$or'>]?: QueryFilterValue<V>[];
  //     }
  | string
  | number;

export type QueryOptions<T = any> = {
  operator?: QueryOperator;
  expand?: boolean | string | string[];
  paginate?: boolean | 'cursor' | 'offset';
  search?: string;
  fields?: string | string[] | { [P in keyof Partial<T>]: boolean | 1 | 0 };
  sort?: string | SortObject<T> | SortObject<T>[];
  offset?: string | number;
  limit?: string | number;
  cursor?: string | QueryFilter<T>;
};

export type SortObject<T> = {
  [P in keyof Partial<T>]:
    | SortValue
    | { sort: SortValue; null: 'first' | 'last' };
};

export type SortValue = 'asc' | 'desc' | 1 | -1;

export type ExpandField = {
  from?: string;
  localField?: string;
  foreignField?: string;
  as?: string;
};

export type FieldType =
  | 'scalar'
  | 'scalar_list'
  | 'relation'
  | 'relation_list'
  | 'composite'
  | 'composite_list';

type Operator =
  | '$and'
  | '$or'
  | '$nor'
  | '$in'
  | '$nin'
  | '$not'
  | '$literal'
  | '$eq'
  | '$ne'
  | '$lt'
  | '$lte'
  | '$gt'
  | '$gte'
  | '$some'
  | '$every'
  | '$none'
  | '$arraySome'
  | '$arrayEvery'
  | '$arrayNone';

export type QueryOperator = '$and' | '$or' | '$nor';

export type QuerySchema<T> = {
  [K in keyof Partial<T>]?: QueryFieldConfig<T[K]>;
};

export type QueryFieldConfig<T> = {
  type?: FieldType;
  searchable?: boolean;
  expand?: boolean | ExpandField;
  // schema?: QuerySchema<
  //   Partial<T>[K] extends Array<object>
  //     ? Partial<T>[K][number]
  //     : Partial<T>[K]
  // >;
  schema?: QuerySchema<T>;
};

// QuerySchema<T>[Extract<keyof T, string>]
