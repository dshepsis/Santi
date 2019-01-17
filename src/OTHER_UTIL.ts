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
