'use strict';
const Santi = (()=>{
  function appendContent(parent, content) {
    for (const item of content) {
      if (item instanceof Node) parent.appendChild(item);
      else parent.appendChild(document.createTextNode(item));
    }
    return parent;
  }
  /* Allows you to create an element and its contents/attributes in-line */
  function createEl(tagName, content, attributes) {
    const newEle = document.createElement(tagName);
    if (content !== undefined) appendContent(newEle, content);
    if (attributes !== undefined) {
      for (const attrName of Object.keys(attributes)) {
        newEle.setAttribute(attrName, attributes[attrName]);
      }
    }
    return newEle;
  }
  /* Turns strings and lazy functions into HTMLElements: */
  function delazyNode(spec, lazyArgs) {
    if (spec instanceof Node) return spec;
    if (typeof spec === 'string') {
      /* Make elements out of strings like 'p#id.class@attribute="value"' */
      const tagname = spec.match(/^[\w-]+/)[0];
      const idMatch = spec.match(/#([\w-]+)/);
      const classMatch = spec.match(/\.[\w-]+/g);
      const attrs = {};
      if (idMatch !== null) attrs.id = idMatch[1];

      /* Match strings of the form @key="value", allowing escaping using \ */
      const attrRegex = /@([\w-]+)(?:="((?:[^"\\]|\\"|\\\\)+)")?/g;
      while (true) {
        const match = attrRegex.exec(spec);
        if (match === null) break;
        if (match[2] === undefined) attrs[match[1]] = "";
        /* De-escape backslashes: */
        else attrs[match[1]] = match[2].replace(/\\(["\\])/g, '$1');
      }
      const elem = createEl(tagname, undefined, attrs);
      if (classMatch !== null) {
        for (const classToken of classMatch) {
          elem.classList.add(classToken.substr(1));
        }
      }
      return elem;
    }
    if (typeof spec === 'function') return delazyNode(spec(lazyArgs));

    let errorType = typeof spec;
    if (errorType === 'object') errorType = spec.constructor;
    throw new TypeError(
      `Specification wasn't an HTMLElement, string, or lazy function. `+
      `Instead, it was a '${errorType}'.`
    );
  }
  /* Turns functions, arrays, and strings into element wrapper chains, using
   * delazyNode.
   * The first parameter, wrapSpec, is used to determine what the structure
   * of the replacement wrappings will be. It may be specified as a function of
   * the array of old wraps, an array of lazy-node expressions, or
   * as a single lazy-node expression.
   * Accepts a "templateWraps" parameter which is mandatory if
   * wrapSpec is not a function or array. In this case, the returned array of
   * wraps has the same length as the template.  */
  function delazyWraps(wrapSpec, templateWraps) {
    let newWraps;
    if (wrapSpec instanceof Node) {
      throw new TypeError(
        'The wrap specification may not be a Node, as a node cannot wrap '+
        'itself. If you would like to pass in constructed nodes to be repeated '+
        'as the new wrapping, use a lazy function instead. '+
        "e.g. ()=>Santi.makeEl('div', undefined, {class='my-wrap'})"
      );
    }
    if (typeof wrapSpec === 'function') {
      newWraps = wrapSpec(templateWraps).map(lazyNode => delazyNode(lazyNode));
    } else if (Array.isArray(wrapSpec)) {
      newWraps = wrapSpec.map(lazyNode => delazyNode(lazyNode));
    } else {
      newWraps = Array.from({length: templateWraps.length});

      /* Don't use array.fill here, because we want clones: */
      newWraps.map(()=>delazyNode(wrapSpec));
    }
    elemArrayToWraps(newWraps);
    return newWraps;
  }
  /* Takes an array of lone elements and makes each one the parent of the next: */
  function elemArrayToWraps(elems) {
    for (let i = 1, len = elems.length; i < len; ++i) {
      elems[i-1].appendChild(elems[i]);
    }
    return elems;
  }
  function getWrapsAround(node) {
    /* We read the wrappers inside-out, but want to return them outside-in: */
    const revWrappers = [];
    while (true) {
      node = node.parentElement;
      if (node === null || node.childNodes.length !== 1) break;
      revWrappers.push(node);
    }
    return revWrappers.reverse();
  }
  function getWrapsWithin(node) {
    const wrappers = [];
    while (node.childNodes.length !== 1) {
      node = node.firstChild;
      /* We don't need to check if node === null, because we already checked
       * that it's parent has one child. */
      wrappers.push(node);
    }
    return wrappers;
  }
  function clearChildren(parent) {
    while (true) {
      const child = parent.firstChild;
      if (child === null) return parent;
      parent.removeChild(child);
    }
  }
  function transferChildren({from, to}) {
    while (true) {
      const child = from.firstChild;
      if (child === null) return to;
      to.appendChild(child);
    }
  }
  /* Swaps the parents of outer 1 and 2, and the children of inner 1 and 2.
   * This is a generalization of swapNodes and swapWraps. */
  function swapParentsAndChildren(outer1, inner1, outer2, inner2) {
    const parent1 = outer1.parentElement;
    const parent2 = outer2.parentElement;

    const inner2OldChildren = Array.from(inner2.childNodes);
    const outer2OldSibling = outer2.nextSibling;

    /* Put group 2 in group 1's place: */
    clearChildren(inner2);
    transferChildren({from: inner1, to: inner2});
    if (parent1 === null) outer2.remove();
    else parent1.insertBefore(outer2, outer1);

    /* Put group 1 in group 2's previous place: */
    if (parent2 === null) outer1.remove();
    else parent2.insertBefore(outer1, outer2OldSibling);
    appendContent(inner1, inner2OldChildren);
    return [outer1, inner1, outer2, inner2];
  }
  function swapNodes(node1, node2) {
    swapParentsAndChildren(node1, node1, node2, node2);
    return [node1, node2];
  }
  /* Accepts 2 arrays of wrapper chains (elements containing only the next
   * element in the list as their sole child) and swaps them in the DOM: */
  function swapWraps(wraps1, wraps2) {
    const outer1 = wraps1[0];
    const inner1 = wraps1[wraps1.length-1];
    const outer2 = wraps2[0];
    const inner2 = wraps2[wraps2.length-1];

    /* If an empty array is given for either wrapping, unwrap the other one.
     * This is done because otherwise some parameters to swapParentsAndChildren
     * would be undefined, which would cause an error. The reason we allow
     * empty arrays at all is because that is the best way to isomorphize the
     * action of unwrapping something while optionally replacing those wrappings. */
    if (wraps1.length === 0) unwrap(outer2, inner2);
    else if (wraps2.length === 0) unwrap(outer1, inner1);
    else swapParentsAndChildren(outer1, inner1, outer2, inner2);
    return [wraps1, wraps2];
  }
  function wrap(node, wrapper) {
    const parent = node.parentElement;
    if (parent === null) parent.insertBefore(wrapper, node);
    wrapper.appendChild(node);
    return wrapper;
  }
  function wrapInner(node, wrapper) {
    transferChildren({from: node, to: wrapper});
    node.appendChild(wrapper);
    return node;
  }
  function unwrap(outerNode, innerNode=outerNode) {
    const parent = outerNode.parentElement;
    if (parent === null) throw new Error('You cannot unwrap a parentless node.');
    while (true) {
      const child = innerNode.firstChild;
      if (child === null) break;
      parent.insertBefore(child, outerNode);
    }
    outerNode.remove();
    return parent;
  }

  /* Checks if the value is matched by the whitelist. The whitelist can be
   * specified as a bool, string, an array of strings, Set, regex, or function.
   * Any additional arguments will be passed to whitelist functions: */
  function whitelistStr(whitelist, value, ...fnArgs) {
    /* Explicit true acts as a wildcard; any value is allowed: */
    if (whitelist === true) return true;

    if (typeof whitelist === 'string') return (whitelist === value);
    /* Any falsey value besides an empty string indicates that all values are
    * disallowed: */
    if (!whitelist) return false;
    if (Array.isArray(whitelist)) return (whitelist.indexOf(value) !== -1);
    if (whitelist instanceof Set) return (whitelist.has(value));
    if (whitelist instanceof RegExp) return (whitelist.test(value));
    if (typeof whitelist === 'function') return whitelist(value, ...fnArgs);
    throw new TypeError(
      'Whitelist must be a string, array, Set, RegExp, or function.'
    );
  }

  const GLOBAL_OPERATIONS = {
    forEach: callback => node => callback(node),
    remove: active => node => active && node.remove(),
    replaceWith: replacement => node => {
      swapNodes(node, delazyNode(replacement, node));
    },
    replaceWraps: ({direction, replacement}) => node => {
      let oldWraps;
      if (direction === undefined) oldWraps = [node];
      else if (typeof direction === 'function') {
        oldWraps = direction(node);
      } else if (typeof direction === 'string') {
        switch (direction) {
          case 'self':
            oldWraps = [node]; break;
          case 'around': case 'ancestors':
            oldWraps = getWrapsAround(node); break;
          case 'within': case 'descendants':
            oldWraps = getWrapsWithin(node); break;
          default:
            throw new Error(`Unexpected direction string "${direction}"!`);
        }
      } else {
        throw new TypeError('Wrapping direction must be a function or string!');
      }

      swapWraps(oldWraps, delazyWraps(replacement, oldWraps));
    },
    wrapWith: wrapper => node => wrap(node, wrapper),
    wrapChildrenWith: wrapper => parent => wrapInner(parent, wrapper),
    unwrap: ()=> unwrap,
    allowStyles: whitelist => elem => {
      const whiteSet = new Set(whitelist);
      for (const property of elem.style) {
        if (!whiteSet.has(property)) elem.style[property] = "";
      }
      if (elem.getAttribute('style') === "") elem.removeAttribute('style');
    },
    removeStyles: blacklist => elem => {
      for (const property of blacklist) elem.style[property] = "";
      if (elem.getAttribute('style') === "") elem.removeAttribute('style');
    },
    allowClasses: whitelist => elem => {
      const whiteSet = new Set(whitelist);
      const toRemove = [];
      for (const className of elem.classList) {
        /* We cannot remove the classes in-place because removing the current
         * class in iteration causes the next one to be skipped. So, instead,
         * we save the classes to be removed for later: */
        if (!whiteSet.has(className)) toRemove.push(className);
      }
      for (const badClass of toRemove) elem.classList.remove(badClass);
      if (elem.getAttribute('class') === "") elem.removeAttribute('class');
    },
    removeClasses: blacklist => elem => {
      for (const className of blacklist) elem.classList.remove(className);
      if (elem.getAttribute('class') === "") elem.removeAttribute('class');
    },
    allowAttributes: whitelist => elem => {
      const attrs = elem.attributes;
      if (Array.isArray(whitelist)) {
        const whiteSet = new Set(whitelist);
        const toRemove = [];
        for (let i = 0, len = attrs.length; i < len; ++i) {
          const attrName = attrs[i].name;
          /* Just like with removing classes, we can't remove attributes
           * in-place because it causes skipping in the iteration order: */
          if (!whiteSet.has(attrName)) toRemove.push(attrName);
        }
        for (const badAttr of toRemove) elem.removeAttribute(badAttr);
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
      if (Array.isArray(blacklist)) {
        for (const attrName of blacklist) elem.removeAttribute(attrName);
      } else if (typeof blacklist === 'object') {
        for (const attrName of Object.keys(blacklist)) {
          const attrVal = elem.getAttribute(attrName);

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

  const RULES = {
    minify: {
      select: '#text',
      remove: true,
      /* Remove all text nodes that contain non-displayed whitespace: */
      onlyIf(text) {
        if (!/^\s*$/.test(text.data)) return false;
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
        replacement: oldWraps=>{
          const newWraps = new Set();
          for (const wrap of oldWraps) {
            const style = getComputedStyle(wrap);
            if (Number(style.fontWeight) >= 600) newWraps.add('strong');
            if (['italic', 'oblique'].includes(style.fontStyle)) newWraps.add('em');
            if (style.textDecoration.includes('underline')) newWraps.add('u');
            if (style.textDecoration.includes('line-through')) newWraps.add('strike');
          }
          return Array.from(newWraps);
        }
      }
    }
  };

  /* Returns the first key of keys which exists on obj, or null if none match: */
  function getFirstKey(obj, keys) {
    for (const key of keys) {
      if (key in obj) return key;
    }
    return null;
  }
  /* Because NodeIterators are, surprisingly, not Iterable, we have to
   * write an iterator for it: */
  function* iterableNodeIter(root, whatToShow, filter) {
    const nodeIter = document.createNodeIterator(root, whatToShow, filter);
    while (true) {
      const next = nodeIter.nextNode();
      if (next === null) break;
      yield next;
    }
  }
  /* Returns an iterator over all text nodes which are descendants to all
   * given root nodes: */
  function* textDescendantsIter(roots) {
    /* Since roots could conceivably contain other roots, we need some way to
     * avoid yielding the same text node twice: */
    const alreadyYieldedNodes = new WeakSet();
    for (const root of roots) {
      for (const text of iterableNodeIter(root, NodeFilter.SHOW_TEXT)) {
        if (alreadyYieldedNodes.has(text)) continue;
        alreadyYieldedNodes.add(text);
        yield text;
      }
    }
  }
  /* Returns an iterator over all text nodes which are children to all given
   * root nodes: */
  function* textChildrenIter(parents) {
    for (const parent of parents) {
      for (const child of parent.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) yield child;
      }
    }
  }
  /* Returns an array of HTML Elements based on the given selector. The selector
   * may be a CSS Selector, a function, or an object with properties that
   * modify a root selector. Returns an iterable. */
  function selectNodes(root, selector) {
    if (typeof selector === 'string') {
      /* Special handling for getting all text nodes, which cannot be done
      * using CSS selectors since they can't select text nodes at all: */
      if (selector ==='#text') {
        return iterableNodeIter(root, NodeFilter.SHOW_TEXT);
      }
      return root.querySelectorAll(selector);
    }
    if (typeof selector !== 'object') {
      throw new TypeError('Selector must be a string or object!');
    }
    const baseSelection = selectNodes(root, selector.root);
    const modifier = selector.modifier;
    if (typeof modifier === 'string') {
      switch (modifier) {
        case 'text-descendants': case '#text':
          return textDescendantsIter(baseSelection);
        case 'text-children': case '> #text': case '>#text':
          return textChildrenIter(baseSelection);
        default:
          throw new Error(`Unrecognized selector modifier string "${modifier}"`);
      }
    } else {
      throw new TypeError('Selector modifier must be a string!');
    }
  }

  class Santi {
    constructor(ruleset) {
      this.operations = GLOBAL_OPERATIONS;
      this.ruleset = ruleset;
    }
    sanitize(root) {
      if (typeof root === 'string') {
        root = document.createRange().createContextualFragment(root);
      }
      for (const rule of this.ruleset) {
        const operationName = getFirstKey(rule, Object.keys(this.operations));
        if (operationName === null) {
          throw new Error(`Rule given didn't match any known operation.`);
        }

        /* Iterate over the raw selection and apply filters: */
        const rawSelection = selectNodes(root, rule.select);
        let filteredSelection;
        const canAllow = !!rule.onlyIf;
        const canReject = !!rule.except;
        if (!canReject && !canAllow) {
          /* If there are no filters in the rule, copy the raw selection.
           * We must use Array.from because the iterator provided by selectNodes
           * may not be compatible with removing or replacing nodes in-place: */
          filteredSelection = Array.from(rawSelection);
        } else {
          filteredSelection = [];
          const allow = (canAllow) ? node => rule.onlyIf(node) : ()=>true;
          const reject = (canReject) ? node => rule.except(node) : ()=>false;
          for (const node of rawSelection) {
            if (allow(node) && !reject(node)) filteredSelection.push(node);
          }
        }

        /* Apply the operation to all nodes in the filtered selection: */
        const operation = this.operations[operationName](rule[operationName]);
        for (const node of filteredSelection) operation(node);
      }
      return root;
    }
  }
  Object.assign(Santi, {
    appendContent,
    createEl,
    delazyNode,
    delazyWraps,
    getWrapsAround,
    getWrapsWithin,
    clearChildren,
    transferChildren,
    wrap,
    wrapInner,
    unwrap,
    swapNodes,
    swapWraps,
    textDescendantsIter,
    textChildrenIter,
    GLOBAL_OPERATIONS,
    RULES
  });
  return Santi;
})();

const sanitizer = new Santi([Santi.RULES.semantify]);
sanitizer.sanitize(document.body);
