type stringTest = (str: String) => boolean;

/**
 * Checks if the given style property has the given value, and removes the
 * property if it does.
 */
function checkAndRemoveStyle(
  styleObj: CSSStyleDeclaration,
  propertyName: string,
  valueTest: string|string[]|stringTest
): boolean {
  const value = styleObj.getPropertyValue(propertyName);
  if (value === '') {
    return false;
  }
  let match = false;
  if (typeof valueTest === 'string') {
    match = (value === valueTest);
  } else if (Array.isArray(valueTest)) {
    match = valueTest.includes(value);
  } else {
    match = valueTest(value);
  }
  if (match) {
    styleObj.removeProperty(propertyName);
  }
  return match;
}
/**
 * Checks if the given style value, contains the given substring or
 * matches the given RegExp, and removes/replaces that substring if present.
 */
function checkAndRemoveStyleSubstring(
  styleObj: CSSStyleDeclaration,
  propertyName: string,
  valueTest: string|RegExp,
  replacement = ''
): boolean {
  const value = styleObj.getPropertyValue(propertyName);
  if (value === '') {
    return false;
  }
  const replacedVal = value.replace(valueTest, replacement);
  if (value === replacedVal) {
    return false;
  }
  /* If replacedVal is empty, then setProperty will just remove the property: */
  styleObj.setProperty(propertyName, replacedVal);
  return true;
}

/**
 * Given an iterable of wrapper elements, returns an array of semantic
 * elements based on the styles of the wrappers
 */
function semantifyWraps(oldWraps: Iterable<Node>) {
  const newWraps = new Set();
  for (const oldWrap of oldWraps) {
    if (!(oldWrap instanceof HTMLElement)) {
      continue;
    }
    const style = oldWrap.style;
    const fontWeightThreshold = (fw: string) => (Number(fw) >= 600);
    if (checkAndRemoveStyle(style, 'fontWeight', fontWeightThreshold)) {
      newWraps.add('strong');
    }
    if (checkAndRemoveStyle(style, 'fontStyle', ['italic', 'oblique'])) {
      newWraps.add('em');
    }
    if (style.textDecoration) {
      if (checkAndRemoveStyleSubstring(style, 'textDecoration', 'underline')) {
        newWraps.add('u');
      }
      if (checkAndRemoveStyleSubstring(style, 'textDecoration', 'line-through')) {
        newWraps.add('strike');
      }
    }
  }
  return Array.from(newWraps);
}

export const semantify = [
  {
    select: 'span',
    wrapWraps: {
      direction: ['self', 'inner'],
      replacement: semantifyWraps
    }
  },
  {
    remove: true,
    onlyIf(span: HTMLElement) {
      return ['', null].includes(span.getAttribute('style'));
    }
  }
];
