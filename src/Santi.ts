import * as DOMT from 'DOM_TYPES';
import * as DOMU from 'DOM_UTIL';

/* Utility functions: */

/* Checks if the value is matched by the whitelist. The whitelist can be
 * specified as a bool, string, an array of strings, Set, regex, or function.
 * Any additional arguments will be passed to whitelist functions: */
type StringWhitelist = (
  boolean | string | string[] | Set<string> |
  RegExp |
  ((value: string, ...fnArgs: any[]) => boolean)
);
function whitelistStr(
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

export type SantiOperation = (options: any) => (node: Node) => void;
export interface OperationLibrary {
  [name: string]: SantiOperation;
}
export const OPERATIONS: OperationLibrary = {
  forEach: callback => node => callback(node),
  remove: active => node => {
    if (active && DOMT.isChildNode(node)) {
      node.remove();
    }
  },
  replaceWith: replacement => node => {
    DOMU.swapNodes(node, DOMU.delazyNode(replacement, node));
  },
  replaceWraps: ({direction, replacement}) => node => {
    const oldWraps = DOMU.getWrapsDirection(node, direction);
    const newWraps = DOMU.delazyWraps(replacement, oldWraps);
    DOMU.swapWraps(oldWraps, newWraps);
  },
  wrapWith: wrapper => node => DOMU.wrap(node, wrapper),
  wrapChildrenWith: wrapper => parent => {
    if (DOMT.isAppendable(parent)) {
      DOMU.wrapInner(parent, wrapper);
    }
  },
  unwrap: active => active && DOMU.unwrap,
  allowStyles: whitelist => elem => {
    if (!(elem instanceof HTMLElement)) {
      return;
    }
    const whiteSet = new Set(whitelist);
    const toRemove = [];
    for (const property of elem.style) {
      /* We cannot remove styles in-place because it breaks iteration, causing
       * styles to be skipped when checking. So we record what to remove: */
      if (!whiteSet.has(property)) {
        toRemove.push(property);
      }
    }
    for (const badProperty of toRemove) {
      elem.style.removeProperty(badProperty);
    }
    if (elem.getAttribute('style') === '') {
      elem.removeAttribute('style');
    }
  },
  removeStyles: blacklist => elem => {
    if (!(elem instanceof HTMLElement)) {
      return;
    }
    for (const property of blacklist) {
      elem.style.removeProperty(property);
    }
    if (elem.getAttribute('style') === '') {
      elem.removeAttribute('style');
    }
  },
  allowClasses: whitelist => elem => {
    if (!(elem instanceof HTMLElement)) {
      return;
    }
    const whiteSet = new Set(whitelist);
    const toRemove = [];
    for (const className of elem.classList) {
      /* We cannot remove the classes in-place because removing the current
       * class in iteration causes the next one to be skipped. So, instead,
       * we save the classes to be removed for later: */
      if (!whiteSet.has(className)) {
        toRemove.push(className);
      }
    }
    for (const badClass of toRemove) {
      elem.classList.remove(badClass);
    }
    if (elem.getAttribute('class') === '') {
      elem.removeAttribute('class');
    }
  },
  removeClasses: blacklist => elem => {
    if (!(elem instanceof HTMLElement)) {
      return;
    }
    for (const className of blacklist) {
      elem.classList.remove(className);
    }
    if (elem.getAttribute('class') === '') {
      elem.removeAttribute('class');
    }
  },
  allowAttributes: whitelist => elem => {
    if (!(elem instanceof HTMLElement)) {
      return;
    }
    const attrs = elem.attributes;
    if (Array.isArray(whitelist)) {
      const whiteSet = new Set(whitelist);
      const toRemove = [];
      for (let i = 0, len = attrs.length; i < len; ++i) {
        const attrName = attrs[i].name;
        /* Just like with removing classes, we can't remove attributes
         * in-place because it causes skipping in the iteration order: */
        if (!whiteSet.has(attrName)) {
          toRemove.push(attrName);
        }
      }
      for (const badAttr of toRemove) {
        elem.removeAttribute(badAttr);
      }
    } else if (typeof whitelist === 'object') {
      for (let i = 0, len = attrs.length; i < len; ++i) {
        const attrName = attrs[i].name;
        const attrVal = attrs[i].value;

        /* If the value isn't on the whitelist, remove the attribute: */
        if (!whitelistStr(whitelist[attrName], attrVal, elem)) {
          elem.removeAttribute(attrName);
        }
      }
    } else {
      throw new TypeError('Attribute whitelist must be an array or object!');
    }
  },
  removeAttributes: blacklist => elem => {
    if (!(elem instanceof HTMLElement)) {
      return;
    }
    if (Array.isArray(blacklist)) {
      for (const attrName of blacklist) {
        elem.removeAttribute(attrName);
      }
    } else if (typeof blacklist === 'object') {
      for (const attrName of Object.keys(blacklist)) {
        const attrVal = elem.getAttribute(attrName);
        if (attrVal === null) {
          continue;
        }
        /* If the value is on the blacklist, remove the attribute: */
        if (whitelistStr(blacklist[attrName], attrVal, elem)) {
          elem.removeAttribute(attrName);
        }
      }
    } else {
      throw new TypeError('Attribute blacklist must be an array or object!');
    }
  }
};

interface SantiRule {
  select: string;
  except?: DOMT.NodeTest;
  onlyIf?: DOMT.NodeTest;
  [operationName: string]: any;
}
const RULES: {[name: string]: SantiRule} = {
  minify: {
    select: '#text',
    remove: true,
    /* Remove all text nodes that contain non-displayed whitespace: */
    onlyIf(text: Text) {
      if (text.data === '') {
        return true;
      }
      if (!/^\s+$/.test(text.data)) {
        return false;
      }
      const range = document.createRange();
      range.selectNodeContents(text);
      const rect = range.getBoundingClientRect();
      return (rect.width === 0 && rect.height === 0);
    }
  },
  semantify: {
    select: 'span',
    replaceWraps: {
      direction: 'self',
      replacement: (oldWraps: Node[]) => {
        const newWraps = new Set();
        for (const oldWrap of oldWraps) {
          if (!(oldWrap instanceof HTMLElement)) {
            continue;
          }
          const style = getComputedStyle(oldWrap);
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
        return [...Array.from(newWraps), ...oldWraps];
      }
    }
  }
};

/* Returns the first key of keys which exists on obj, or null if none match: */
function getFirstKey<T extends object>(obj: T, keys: (keyof T)[]) {
  for (const key of keys) {
    if (key in obj) {
      return key;
    }
  }
  return null;
}

/**
 * Accepts a declarative ruleset used to transform a DOM tree.
 */
class Santi {
  operations: OperationLibrary;
  ruleset: SantiRule[];
  constructor(ruleset: SantiRule[]) {
    this.operations = OPERATIONS;
    this.ruleset = ruleset;
  }
  sanitize(root: string|DOMT.AppendableNode) {
    if (typeof root === 'string') {
      root = document.createRange().createContextualFragment(root);
    }
    for (const rule of this.ruleset) {
      const operationName = getFirstKey(rule, Object.keys(this.operations));
      if (operationName === null) {
        throw new Error(`Rule given didn't match any known operation.`);
      }

      /* Iterate over the raw selection and apply filters: */
      const rawSelection = DOMU.selectNodes(root, rule.select);
      let filteredSelection;
      if (!rule.onlyIf && !rule.except) {
        /* If there are no filters in the rule, copy the raw selection.
         * We must use Array.from because the iterator provided by selectNodes
         * may not be compatible with removing or replacing nodes in-place: */
        filteredSelection = Array.from(rawSelection);
      } else {
        filteredSelection = [];
        for (const node of rawSelection) {
          /* If rule.onlyIf is undefined, then the node is allowed by default: */
          const allowed = (!rule.onlyIf || rule.onlyIf(node));
          const rejected = (!rule.except || rule.except(node));
          if (allowed && !rejected) {
            filteredSelection.push(node);
          }
        }
      }

      /* Apply the operation to all nodes in the filtered selection: */
      const operation = this.operations[operationName](rule[operationName]);
      for (const node of filteredSelection) {
        operation(node);
      }
    }
    return root;
  }
}

Object.assign(Santi, {
  OPERATIONS,
  RULES
});

export {Santi};
