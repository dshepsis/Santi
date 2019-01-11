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
 * An object for containing data about what styles are semantified and how.
 * Exposes functions for getting a list of CSS properties checked by the
 * semantifier, as well as for generating semantic tag names from elements and
 * styles declaration objects.
 */
const SemantifierData = (() => {
  interface SemantifierMap {
    [index: string]: (style: CSSStyleDeclaration, property: string) => string[];
  }
  const styleToSemanticTagName: SemantifierMap = {
    fontWeight(style: CSSStyleDeclaration, fontWeight) {
      const fontWeightThreshold = (fw: string) => (Number(fw) >= 600);
      if (checkAndRemoveStyle(style, fontWeight, fontWeightThreshold)) {
        return ['strong'];
      }
      return [];
    },
    fontStyle(style: CSSStyleDeclaration, fontStyle) {
      if (checkAndRemoveStyle(style, fontStyle, ['italic', 'oblique'])) {
        return ['em'];
      }
      return [];
    },
    textDecoration(style: CSSStyleDeclaration, textDecoration) {
      const semanticTagNames = [];
      if (checkAndRemoveStyleSubstring(style, textDecoration, 'underline')) {
        semanticTagNames.push('u');
      }
      if (checkAndRemoveStyleSubstring(style, textDecoration, 'line-through')) {
        semanticTagNames.push('strike');
      }
      return semanticTagNames;
    }
  };
  return {
    checkedProperties(): string[] {
      return Object.keys(styleToSemanticTagName);
    },
    isCheckedProperty(propertyName: string): boolean {
      return (propertyName in styleToSemanticTagName);
    },
    getSemanticTagNameForProperty(
      style: CSSStyleDeclaration,
      propertyName: string
    ): string[] {
      if (this.isCheckedProperty(propertyName)) {
        return styleToSemanticTagName[propertyName](style, propertyName);
      } else {
        return [];
      }
    },
    getAllSemanticTagNamesForStyle(style: CSSStyleDeclaration): string[] {
      const tagNameSet = new Set();
      for (const property of this.checkedProperties()) {
        const semanticTagNames = this.getSemanticTagNameForProperty(
          style, property
        );
        for (const tagName of semanticTagNames) {
          tagNameSet.add(tagName);
        }
      }
      return Array.from(tagNameSet);
    },
    getAllSemanticTagNamesForWraps(wraps: Iterable<Node>): string[] {
      const tagNameSet = new Set();
      for (const wrap of wraps) {
        if (!(wrap instanceof HTMLElement)) {
          continue;
        }
        const style = wrap.style;
        for (const property of this.checkedProperties()) {
          const semanticTagNames = (
            this.getSemanticTagNameForProperty(style, property)
          );
          for (const tagName of semanticTagNames) {
            tagNameSet.add(tagName);
          }
        }
      }
      return Array.from(tagNameSet);
    },
  };
})();

/**
 * Given an iterable of wrapper elements, returns an array of semantic
 * elements based on the styles of the wrappers
 */
function semantifyWraps(oldWraps: Iterable<Node>, USE_SEMANTIFIER_DATA = true) {
  if (USE_SEMANTIFIER_DATA) {
    return SemantifierData.getAllSemanticTagNamesForWraps(oldWraps);
  } else {
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
}

export const ALLOWED_SPAN_STYLES = Object.freeze(
  [...SemantifierData.checkedProperties(), 'color']
);

export const semantify = [
  {
    select: 'span',
    allowStyles: ALLOWED_SPAN_STYLES
  },
  {
    wrapWraps: {
      direction: ['self', 'inner'],
      replacement: semantifyWraps
    }
  },
  {
    unwrap: true,
    onlyIf(span: HTMLElement) {
      return ['', null].includes(span.getAttribute('style'));
    }
  }
];
