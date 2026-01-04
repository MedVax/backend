export function convertStringToType(value: string | string[], type: string) {
  switch (type.toLocaleLowerCase()) {
    case 'string':
      return Array.isArray(value)
        ? [...new Set(value.map(String))]
        : String(value);
    case 'number':
      return Array.isArray(value)
        ? [...new Set(value.map(Number))]
        : Number(value);
    case 'boolean':
      return Array.isArray(value)
        ? [...new Set(value.map(Boolean))]
        : Boolean(value);
    case 'multiselect':
      return Array.isArray(value) ? [...new Set(value)] : value?.split(',');
    default:
      return value;
  }
}

export function operatorFilter(operator: any, value: any, filterValue: any) {
  const operatorOptions = {
    eq: (v: any) => v === filterValue,
    ne: (v: any) => v !== filterValue,
    gt: (v: any) => v > filterValue,
    lt: (v: any) => v < filterValue,
    gte: (v: any) => v >= filterValue,
    lte: (v: any) => v <= filterValue,
    in: (v: any) => filterValue?.includes(v),
    nin: (v: any) => !filterValue?.includes(v),
    contains: (v: any) => v?.includes(filterValue),
    ncontains: (v: any) => !v?.includes(filterValue),
    startswith: (v: any) => v?.startsWith(filterValue),
    endswith: (v: any) => v?.endsWith(filterValue),
  };
  const operatorOptionFunc = operatorOptions[operator?.toLocaleLowerCase()];
  return Array.isArray(value)
    ? value.some(operatorOptionFunc)
    : operatorOptionFunc(value);
}
