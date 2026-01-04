export function escapeRegExp(str = '') {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export function cast(str?: string) {
  if (!(typeof str === 'string' && str)) return str;

  return str === 'null'
    ? null
    : str === 'undefined'
      ? undefined
      : str === "'null'" || str === '"null"'
        ? 'null'
        : str === 'true'
          ? true
          : str === 'false'
            ? false
            : /^[0-9]+$/g.test(str)
              ? Number(str)
              : isJson(str)
                ? JSON.parse(str)
                : str;
}

export function isJson(str?: string) {
  if (str && typeof str === 'string') {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {}
  }
  return false;
}

export function accessObjectProperty<T>(obj: T, desc: string) {
  const arr = desc ? desc.split('.') : [];
  let result = { ...obj } as any;
  while (arr.length && (result = result?.[arr.shift() as keyof T]));
  return result;
}

export function assignObjectProperty(
  desc: string,
  value: any,
  options: { init?: any; merge?: boolean } = {},
) {
  const { init, merge } = options;
  return assign(desc.split('.'), value, init);
  function assign(nestedProperties: string[], value: any, object: any) {
    const key = nestedProperties.shift();

    if (!key) return object;

    const isIndex = Number(key) >= 0;
    const newObject = object ? object : isIndex ? [] : {};
    newObject[key] = nestedProperties.length
      ? assign(nestedProperties, value, newObject[key])
      : merge && typeof value === 'object'
        ? Object.assign(Array.isArray(value) ? [] : {}, newObject[key], value)
        : value;
    return newObject;
  }
}

export function isObject<T = object>(value: T): value is T {
  return value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
export function mergeDeep<T = object>(target: T, ...sources: any[]) {
  if (!sources.length) return target;
  const source = sources.shift();

  if (
    (isObject(target) && isObject(source)) ||
    (Array.isArray(target) && Array.isArray(source))
  ) {
    for (const key in source) {
      if (isObject(target[key]) && isObject(source[key])) {
        // if (!target[key]) {
        //   target[key] = {};
        // }
        target[key] = mergeDeep(target[key], source[key]);
      } else if (Array.isArray(target[key]) && Array.isArray(source[key])) {
        // if (!target[key]) {
        //   target[key] = [];
        // }
        target[key] = mergeDeep(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  return mergeDeep(target, ...sources);
}
