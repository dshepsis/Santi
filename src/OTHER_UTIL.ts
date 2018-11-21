/**
 * Checks if the value is matched by the whitelist. The whitelist can be
 * specified as a bool, string, an array of strings, Set, regex, or function.
 * Any additional arguments will be passed to whitelist functions:
 */
export type StringWhitelist = (
  boolean | string | string[] | Set<string> |
  RegExp |
  ((value: string, ...fnArgs: any[]) => boolean)
);
export function whitelistStr(
  whitelist: StringWhitelist,
  value: string,
  ...fnArgs: any[]
) {
  if (typeof whitelist === 'boolean') {
    return whitelist;
  }
  if (typeof whitelist === 'string') {
    return (whitelist === value);
  }
  if (Array.isArray(whitelist)) {
    return (whitelist.indexOf(value) !== -1);
  }
  if (whitelist instanceof Set) {
    return (whitelist.has(value));
  }
  if (whitelist instanceof RegExp) {
    return (whitelist.test(value));
  }
  return whitelist(value, ...fnArgs);
}

/** Returns the first key of `keys` which exists on `obj`, or null if none match: */
export function getFirstKey<T extends object>(obj: T, keys: (keyof T)[]) {
  for (const key of keys) {
    if (key in obj) {
      return key;
    }
  }
  return null;
}

/**
 * Given an iterable of wrapper elements, returns an array of semantic
 * elements based on the styles of the wrappers
 */
export function semantifyWraps(oldWraps: Iterable<Node>) {
  const newWraps = new Set();
  for (const oldWrap of oldWraps) {
    if (!(oldWrap instanceof HTMLElement)) {
      continue;
    }
    const style = oldWrap.style;
    if (Number(style.fontWeight) >= 600) {
      newWraps.add('strong');
    }
    if (style.fontStyle && ['italic', 'oblique'].includes(style.fontStyle)) {
      newWraps.add('em');
    }
    if (style.textDecoration) {
      if (style.textDecoration.includes('underline')) {
        newWraps.add('u');
      }
      if (style.textDecoration.includes('line-through')) {
        newWraps.add('strike');
      }
    }
  }
  return Array.from(newWraps);
}
