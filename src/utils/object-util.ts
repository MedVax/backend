export function isObject(item: object): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

export function objectAccessor<T>(obj: T, desc: string) {
  const arr = desc ? desc.split('.') : [];
  let result = { ...obj } as any;
  while (arr.length && (result = result?.[arr.shift() as keyof T]));
  return result;
}

/**
 * Dynamically accesses nested properties in an object using a dot-separated string descriptor.
 * Supports traversing both objects and arrays, with options to limit depth, stop on the first match,
 * and simplify single-element arrays.
 *
 * @template T - The type of the object being traversed.
 * @param {T} obj - The object to traverse.
 * @param {string} desc - A dot-separated string indicating the path of the property to access.
 *                         Example: "a.b.c" accesses `obj.a.b.c`.
 * @param {Object} [options] - Optional parameters to control the traversal behavior.
 * @param {number} [options.depthLimit] - Limits the depth of traversal. Stops if this limit is reached.
 *                                        Default: No limit.
 * @param {boolean} [options.stopOnFirstMatch] - If `true`, stops processing arrays after finding
 *                                               the first valid match. Default: `false`.
 * @returns {any} - The value of the resolved property or `undefined` if the path is invalid or
 *                  cannot be fully resolved.
 *
 * @example
 * // Simple object access
 * const obj = { a: { b: { c: 42 } } };
 * objectAccessor(obj, "a.b.c"); // 42
 *
 * @example
 * // Accessing arrays
 * const obj = { a: { b: [{ c: 1 }, { c: 2 }] } };
 * objectAccessor(obj, "a.b.c"); // [1, 2]
 *
 * @example
 * // Handling invalid paths
 * const obj = { a: { b: 1 } };
 * objectAccessor(obj, "a.c.d"); // undefined
 *
 * @example
 * // Stop on first match
 * const obj = { a: { b: [{ c: 1 }, { c: 2 }] } };
 * objectAccessor(obj, "a.b.c", { stopOnFirstMatch: true }); // 1
 */
export function objectAccessorExtended<T>(
  obj: T,
  desc: string,
  options?: { stopOnFirstMatch?: boolean },
): any {
  const keys = desc.split('.');
  let result: any = obj;

  for (const key of keys) {
    if (Array.isArray(result)) {
      // If the current result is an array, process each element
      result = result
        .map((item) => item?.[key]) // Access the key in each element of the array
        .filter((item) => item !== undefined); // Remove undefined results

      // Flatten one level if we're still traversing
      if (result.some(Array.isArray)) {
        result = result.flat();
      }

      if (options?.stopOnFirstMatch) {
        return result[0];
      }
    } else if (result !== null && typeof result === 'object') {
      // Access object properties if it's not an array
      result = result[key];
    } else {
      // If result is neither an array nor an object, return undefined
      return undefined;
    }

    // If result is undefined or null, stop traversal
    if (result === undefined || result === null) {
      return result;
    }
  }

  // If the final result is an array of single elements, simplify it
  if (Array.isArray(result) && result.length === 1) {
    return result[0];
  }

  return result;
}

export function excludeProperties<T>(object: T, exclusions: string[] = []) {
  if (!object) return object;

  let _object: T = { ...object };
  for (const exclusion of exclusions) {
    _object = exclude(_object, exclusion.split('.'));
  }
  return _object;

  function exclude<E>(obj: E, nestedProperties: string[]): E {
    const key = nestedProperties.shift() as any;
    if (!nestedProperties.length) {
      delete obj[key as keyof E];
      return obj;
    }
    return exclude((obj as any)[key], nestedProperties);
  }
}

export function renameProperties<T>(
  object: T,
  renamings: { [x: string]: string } = {},
) {
  if (!object) return object;

  let _object: T = { ...object };
  for (const renaming in renamings) {
    _object = rename(_object, renaming.split('.'), renamings[renaming]);
  }
  return _object;

  function rename<E>(obj: any, nestedProperties: string[], newName: string): E {
    const key = nestedProperties.shift();
    if (!nestedProperties.length) {
      obj[newName] = obj[key];
      delete obj[key];
      return obj;
    }
    return rename(obj[key], nestedProperties, newName);
  }
}

export function shallowClone<T extends object>(source: T): T {
  const copy = {} as T;
  Object.keys(source).forEach((key) => {
    copy[key as keyof T] = source[key as keyof T];
  });

  return copy;
}

// Exclude keys from user
export function excludeKeys<T, Key extends keyof T>(
  user: T,
  keys: Key[],
): Omit<T, Key> | null {
  if (!user) return null;
  return Object?.fromEntries(
    Object?.entries(user)?.filter(([key]) => !keys?.includes(key as any)),
  ) as Omit<T, Key>;
}

export function arrayToObject(array: string[]) {
  const object = {} as any;

  for (let i = 0; i < array.length; i += 2) {
    const key = array[i];
    const value = array[i + 1];
    object[key] = value;
  }
  return object;
}

export function clone<T extends object>(instance: T): T {
  return Object.assign(
    Object.create(Object.getPrototypeOf(instance)),
    instance,
  );
}

export function maskObjectKeys(
  obj: Record<string, any>,
  keys: string[],
): Record<string, any> {
  const masked = { ...obj };
  keys.forEach((key) => {
    if (masked[key]) {
      masked[key] = '*****';
    }
  });
  return masked;
}

/**
 * Remove items from objects
 * @param {Object} obj
 * @param {string[]} keys
 * @returns
 */
export function removeKeys(obj, keys) {
  keys.forEach((key) => {
    // eslint-disable-next-line no-prototype-builtins
    if (obj.hasOwnProperty(key)) {
      delete obj[key];
    }
  });
  return obj;
}
