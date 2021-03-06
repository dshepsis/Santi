import * as DOMT from 'DOM_TYPES';
import * as DOMU from 'DOM_UTIL';
import {WrapChain} from 'WrapChain';
import {whitelistStr} from 'OTHER_UTIL';

/**
 * A curried function which accepts some configuration and returns a function
 * which performs some operation on a Node. This configured operation function
 * is applied to each Node selected by a `SantiRule`.
 */
export type SantiOperation = (options: any) => (node: Node) => void;

/** A dictionary of Santi Operations */
export interface OperationLibrary {
  [name: string]: SantiOperation;
}

// @export
/** A dictionary of standard Santi Operations */
const STANDARD: OperationLibrary = {
  /** Simply executes a callback on each selected node: */
  forEach: callback => node => callback(node),
  /** Removes selected nodes and their children */
  remove: () => node => {
    if (DOMT.isChildNode(node)) {
      node.remove();
    }
  },
  /**
   * Replaces each selected node with the the given replacement, which may be
   * a lazy-node expression (see `DOM_UTIL.delazyNode`).
   */
  replaceWith: replacement => node => {
    DOMU.swapNodes(node, DOMU.delazyNode(replacement, node));
  },
  /**
   * From the base node selection, selects wrapper nodes (nodes with 1 or 0
   * children) in the given direction ('outter' or 'innner') and replaces them
   * with the given replacement wrappers, which may be specified as an array of
   * lazy-node expressions (see 'DOM_UTIL.delazyNode' and 'delazyWraps').
   */
  replaceWraps: ({direction, replacement}) => node => {
    const oldWraps = WrapChain.fromNode(node, direction);
    const newWraps = WrapChain.fromLazy(replacement, oldWraps);
    oldWraps.swapWith(newWraps);
  },
  /**
   * From the base node selection, selects wrapper nodes (nodes with 1 or 0
   * children) in the given direction ('outter' or 'innner') and, between them
   * and their parent node, insert the given replacement wrappers, which may be
   * specified as an array of lazy-node expressions (see 'DOM_UTIL.delazyNode'
   * and 'delazyWraps').
   * I.E.
   */
  wrapWraps: ({direction, replacement}) => node => {
    const oldWraps = WrapChain.fromNode(node, direction);
    const newWraps = WrapChain.fromLazy(replacement, oldWraps);
    newWraps.wrap(oldWraps);
  },
  /** Inserts a wrapper between selected nodes and their parents. */
  wrapWith: wrapper => node => DOMU.wrap(node, DOMU.delazyNode(wrapper, node)),
  /** Inserts a wrapper between selected nodes and their children. */
  wrapChildrenWith: wrapper => parent => {
    if (DOMT.isAppendable(parent)) {
      DOMU.wrapInner(parent, DOMU.delazyNode(wrapper, parent));
    }
  },
  /** Replaces a node with its children. */
  unwrap: () => node => {
    DOMU.unwrap(node);
  },
  /**
   * Removes all *inline* styles properties except those properties in the
   * whitelist. If the whitelist is an iterable, it restricts only the valid
   * properties. If it is an object, the keys restrict the properties while the
   * values are used to restrict the property values via `whitelistStr`.
   */
  allowStyles: whitelist => elem => {
    if (!(elem instanceof HTMLElement)) {
      return;
    }
    const inlineStyle = elem.style;
    const toRemove = [];
    if (Array.isArray(whitelist)) {
      const whiteSet = new Set(whitelist);
      for (const property of inlineStyle) {
        /* We cannot remove styles in-place because it breaks iteration, causing
         * styles to be skipped when checking. So we record what to remove: */
        if (!whiteSet.has(property)) {
          toRemove.push(property);
        }
      }
    } else if (typeof whitelist === 'object') {
      for (const property of inlineStyle) {
        const styleVal = inlineStyle.getPropertyValue(property);
        if (!whitelistStr(whitelist[property], styleVal, elem)) {
          toRemove.push(property);
        }
      }
    } else {
      throw new TypeError('Style whitelist must be an array or object!');
    }
    for (const badProperty of toRemove) {
      inlineStyle.removeProperty(badProperty);
    }
    if (elem.getAttribute('style') === '') {
      elem.removeAttribute('style');
    }
  },
  /**
   * Removes all *inline* styles properties matched by the blacklist. If the
   * blacklist is an iterable, it restricts only the valid properties. If it is
   * an object, the keys restrict the properties while the values are used to
   * restrict the property values via `whitelistStr`.
   */
  removeStyles: blacklist => elem => {
    if (!(elem instanceof HTMLElement)) {
      return;
    }
    const inlineStyle = elem.style;
    if (Array.isArray(blacklist)) {
      for (const property of blacklist) {
        inlineStyle.removeProperty(property);
      }
    } else if (typeof blacklist === 'object') {
      for (const property of Object.keys(blacklist)) {
        const styleVal = inlineStyle.getPropertyValue(property);
        if (styleVal === '') {
          continue;
        }
        if (whitelistStr(blacklist[property], styleVal, elem)) {
          inlineStyle.removeProperty(property);
        }
      }
    } else {
      throw new TypeError('Style whitelist must be an array or object!');
    }
    if (elem.getAttribute('style') === '') {
      elem.removeAttribute('style');
    }
  },
  /**
   * For style properties listed in the whitelist iterable, reads their
   * computed values and applies them in-line. This is useful before
   * removing `<style>` tags, as it allows you to preserve desired styles. This
   * should also be done before using the `allowStyles` operation, if there is
   * any risk of styles being external when Santi is run.
   * NOTE: Don't use combined property names in the whitelist. See
   *   https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle#Notes
   */
  inlineStyles: whitelist => elem => {
    if (!(elem instanceof HTMLElement)) {
      return;
    }
    const compStyle = getComputedStyle(elem);
    for (const property of whitelist) {
      elem.style.setProperty(property, compStyle.getPropertyValue(property));
    }
  },
  /** Removes all classes which do not appear on the whitelist. */
  allowClasses: (whitelist: Iterable<string>) => elem => {
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
  /** Removes all classes which appear on the blacklist. */
  removeClasses: (blacklist: Iterable<string>) => elem => {
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
  /**
   * Removes all attributes not matched by the whitelist. If the whitelist is an
   * iterable, it restricts only the valid attribute names. If it is an object,
   * the keys restrict the attribute names while the values are used to
   * restrict the attribute values via `whitelistStr`.
   */
  allowAttributes: whitelist => elem => {
    if (!(elem instanceof HTMLElement)) {
      return;
    }
    const attrs = elem.attributes;
    const toRemove = [];
    if (Array.isArray(whitelist)) {
      const whiteSet = new Set(whitelist);
      for (let i = 0, len = attrs.length; i < len; ++i) {
        const attrName = attrs[i].name;
        /* Just like with removing classes, we can't remove attributes
         * in-place because it causes skipping in the iteration order: */
        if (!whiteSet.has(attrName)) {
          toRemove.push(attrName);
        }
      }
    } else if (typeof whitelist === 'object') {
      for (const attrData of attrs) {
        const attrName = attrData.name;
        const attrVal = attrData.value;

        /* If the value isn't on the whitelist, remove the attribute: */
        if (!whitelistStr(whitelist[attrName], attrVal, elem)) {
          toRemove.push(attrName);
        }
      }
    } else {
      throw new TypeError('Attribute whitelist must be an array or object!');
    }
    for (const badAttr of toRemove) {
      elem.removeAttribute(badAttr);
    }
  },
  /**
   * Removes all attributes matched by the blacklist. If the blacklist is an
   * iterable, it restricts only the valid attribute names. If it is an object,
   * the keys restrict the attribute names while the values are used to
   * restrict the attribute values via `whitelistStr`.
   */
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
  },
  /** Removes all empty attributes from selected elements. */
  removeEmptyAttributes: () => elem => {
    if (!(elem instanceof HTMLElement)) {
      return;
    }
    const attrs = elem.attributes;
    const toRemove = [];
    for (const attrData of attrs) {
      if (attrData.value === '') {
        toRemove.push(attrData.name);
      }
    }
    for (const emptyAttr of toRemove) {
      elem.removeAttribute(emptyAttr);
    }
  }
};
Object.freeze(STANDARD);
export {STANDARD};
