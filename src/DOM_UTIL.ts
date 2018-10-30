import * as DOMT from 'DOM_TYPES';

type ElementContent = Node|string|Iterable<Node|string>;
/**
 * Appends content to a given Element. Content may be a Node, string, or
 * iterable collection of either. Strings are converted into Text nodes.
 */
export function appendContent <T extends DOMT.AppendableNode>(
  parent: T,
  content: ElementContent
): T {
  if (DOMT.isIterable(content)) {
    for (const item of content) {
      appendContent(parent, item);
    }
  } else {
    if (content instanceof Node) {
      parent.appendChild(content);
    } else {
      parent.appendChild(document.createTextNode(content));
    }
  }
  return parent;
}
interface AttributeMap {
  [attrName: string]: string;
}
/**
 * Creates an element with a given tagname, content, and attributes.
 * Text content may be given as a string, Node, or array of either. Attributes
 * are specified as an object mapping name to value.
 */
export function createEl(
  tagName: string,
  content?: ElementContent,
  attributes?: AttributeMap
) {
  const newEle = document.createElement(tagName);
  if (content !== undefined) {
    appendContent(newEle, content);
  }
  if (attributes !== undefined) {
    for (const attrName of Object.keys(attributes)) {
      newEle.setAttribute(attrName, attributes[attrName]);
    }
  }
  return newEle;
}

type LazyNode = ((arg: any) => Node)|Node|string;
// @export
/**
 * Given a 'specification' string or function, constructors a new Node or
 * HTMLElement. Specification strings are parsed to produce an HTMLElement with
 * a specified tagname and, optionall, id, classes, and attributes.
 * The syntax is as follows:
 *  'tagName#ID.classname.classname@attribute=value@attribute=value'
 *
 * If a Node is passed to this function, it is returned as-is. This is done for
 * the purpose of isomorphically handling LazyNode specifications with regular
 * Nodes constructed elsewhere.
 */
function delazyNode<T>(spec: ((arg: T) => Node), lazyArg: T): Node;
function delazyNode<T extends Node>(spec: T, lazyArg?: any): T;
function delazyNode(spec: string|Node, lazyArg?: any): Node;
function delazyNode(spec: LazyNode, lazyArg?: any): Node {
  if (typeof spec === 'string') {
    /* Make elements out of strings like 'p#id.class@attribute="value"' */
    const tagMatch = spec.match(/^[\w-]+/);
    if (tagMatch === null) {
      throw new Error('Specification string must contain a tag-name!');
    }
    const tagname = tagMatch[0];
    const idMatch = spec.match(/#([\w-]+)/);
    const classMatch = spec.match(/\.[\w-]+/g);
    const attrs: AttributeMap = {};
    if (idMatch !== null) {
      attrs.id = idMatch[1];
    }

    /* Match strings of the form @key="value", allowing escaping using \ */
    const attrRegex = /@([\w-]+)(?:="((?:[^"\\]|\\"|\\\\)+)")?/g;
    while (true) {
      const match = attrRegex.exec(spec);
      if (match === null) {
        break;
      }
      if (match[2] === undefined) {
        attrs[match[1]] = '';
      } else {
        /* De-escape backslashes: */
        attrs[match[1]] = match[2].replace(/\\(["\\])/g, '$1');
      }
    }
    const elem = createEl(tagname, undefined, attrs);
    if (classMatch !== null) {
      for (const classToken of classMatch) {
        elem.classList.add(classToken.substr(1));
      }
    }
    return elem;
  }
  if (spec instanceof Node) {
    return spec;
  }
  return delazyNode(spec(lazyArg));
}
export {delazyNode};

/**
 * Takes an array of lone elements and makes each one the parent of the next.
 */
export function elemArrayToWraps(elems: (Node&ParentNode)[]) {
  for (let i = 1, len = elems.length; i < len; ++i) {
    elems[i - 1].appendChild(elems[i]);
  }
  return elems;
}

// @export
/**
 * Turns functions, arrays, and strings into element wrapper chains, using
 * delazyNode.
 * The first parameter, wrapSpec, is used to determine what the structure
 * of the replacement wrappings will be. It may be specified as a function of
 * the array of old wraps, an array of lazy-node expressions, or
 * as a single lazy-node expression.
 * Accepts a "templateWraps" parameter which is mandatory if
 * wrapSpec is not a function or array. In this case, the returned array of
 * wraps has the same length as the template.
 */
function delazyWraps<T>(
  wrapSpec: (template: T) => LazyNode[],
  templateWraps?: T
): Node[];
function delazyWraps(wrapSpec: LazyNode, templateWraps: ParentNode[]): Node[];
function delazyWraps(wrapSpec: LazyNode[]): Node[];
function delazyWraps(wrapSpec: any, templateWraps?: any): Node[] {
  let newWraps: (Node&ParentNode)[];
  if (wrapSpec instanceof Node) {
    throw new TypeError(
      'The wrap specification may not be a Node, as a node cannot wrap ' +
      'itself. If you would like to pass in constructed nodes to be repeated ' +
      'as the new wrapping, use a lazy function instead. ' +
      'e.g. ()=>Santi.makeEl(\'div\', undefined, {class=\'my-wrap\'})'
    );
  }
  if (typeof wrapSpec === 'function') {
    newWraps = wrapSpec(templateWraps).map((lazyNode: LazyNode) => {
      if (typeof lazyNode === 'function') {
        return delazyNode(lazyNode, templateWraps);
      }
      return delazyNode(lazyNode);
    });
  } else if (Array.isArray(wrapSpec)) {
    newWraps = wrapSpec.map(lazyNode => delazyNode(lazyNode));
  } else {
    newWraps = Array.from({length: templateWraps.length});

    /* Don't use array.fill here, because we want clones: */
    newWraps.map(() => delazyNode(wrapSpec));
  }
  elemArrayToWraps(newWraps);
  return newWraps;
}
export {delazyWraps};

/**
 * Returns an array of elements which are successive wraps around the parameter
 * Node, sorted outside-in. Wraps are Nodes with 1 or 0 children.
 */
export function getWrapsAround(node: Node): Node[] {
  /* We read the wrappers inside-out, but want to return them outside-in: */
  const revWrappers: Node[] = [];
  let nodePtr: Node|null = node;
  while (true) {
    nodePtr = nodePtr.parentElement;
    if (nodePtr === null || nodePtr.childNodes.length !== 1) {
      break;
    }
    revWrappers.push(nodePtr);
  }
  return revWrappers.reverse();
}

/**
 * Returns an array of elements which are successive wraps within the parameter
 * Node, sorted outside-in. Wraps are Nodes with 1 or 0 children.
 */
export function getWrapsWithin(node: Node): Node[] {
  const wrappers = [];
  let nodePtr: Node|null = node;
  while (nodePtr.childNodes.length !== 1) {
    nodePtr = nodePtr.firstChild;
    if (nodePtr === null) {
      /* Technically, we don't need to check if nodePtr === null, because we
       * already checked that it's parent has one child, but TS requires that
       * we check, and the non-null assertion operator is forbidden by
       * tslint.json */
      break;
    }
    wrappers.push(nodePtr);
  }
  return wrappers;
}

type Direction = string|((node: Node) => Node[]);
/**
 * Returns an array of elements which are successive wraps around and/or within
 * the parameter node, based on the value of the direction parameter.
 * Wraps are Nodes with 1 or 0 children.
 */
export function getWrapsDirection(
  node: Node,
  direction?: Direction|Direction[]
): Node[] {
  if (direction === undefined) {
    return [node];
  } else if (typeof direction === 'function') {
    return direction(node);
  } else if (typeof direction === 'string') {
    switch (direction) {
      case 'self':
        return [node];
      case 'around': case 'ancestors':
        return getWrapsAround(node);
      case 'within': case 'descendants':
        return getWrapsWithin(node);
      default:
        throw new Error(`Unexpected direction string "${direction}"!`);
    }
  }
  /* If given an array of directions, e.g. `['around', 'self']`, give the
   * concatenation of those individual results: */
  const wraps = [];
  for (const subDir of direction) {
    const subWraps = getWrapsDirection(node, subDir);
    for (const subNode of subWraps) {
      wraps.push(subNode);
    }
  }
  return wraps;
}

/** Removes all of the parameter Node's child Nodes. */
export function clearChildren(parent: Node) {
  while (true) {
    const child = parent.firstChild;
    if (child === null) {
      return parent;
    }
    parent.removeChild(child);
  }
}

/** Removes all of one Node's children, appending them to another Node. */
export function transferChildren(parents: {from: Node, to: DOMT.AppendableNode}) {
  const {from, to} = parents;
  while (true) {
    const child = from.firstChild;
    if (child === null) {
      return parents;
    }
    to.appendChild(child);
  }
}

// @Not exported
/**
 * Swaps the parents of outer 1 and 2, and the children of inner 1 and 2.
 * This is a generalization of swapNodes and swapWraps.
 */
function swapParentsAndChildren(
  outer1: Node, inner1: Node, outer2: Node, inner2: Node
) {
  const parent1 = outer1.parentElement;
  const parent2 = outer2.parentElement;

  const inner2OldChildren = Array.from(inner2.childNodes);
  const outer2OldSibling = outer2.nextSibling;

  const cantTransferToError = (name: string) => new TypeError(
    `Cannot transfer children because ${name} is not appendable!`
  );
  /* Put group 2 in group 1's place: */
  clearChildren(inner2);
  if (DOMT.isAppendable(inner2)) {
    transferChildren({from: inner1, to: inner2});
  } else if (DOMT.isParentNode(inner1)) {
    throw cantTransferToError('inner2');
  }
  if (parent1 === null) {
    if (DOMT.isChildNode(outer2)) {
      outer2.remove();
    }
  } else {
    parent1.insertBefore(outer2, outer1);
  }

  /* Put group 1 in group 2's previous place: */
  if (parent2 === null) {
    if (DOMT.isChildNode(outer1)) {
      outer1.remove();
    }
  } else {
    parent2.insertBefore(outer1, outer2OldSibling);
  }
  if (DOMT.isAppendable(inner1)) {
    appendContent(inner1, inner2OldChildren);
  } else if (inner2OldChildren.length !== 0) {
    throw cantTransferToError('inner1');
  }
  return [outer1, inner1, outer2, inner2];
}

/**
 * Swaps the parents and children of two individual nodes.
 */
export function swapNodes(node1: Node, node2: Node) {
  if (node1 !== node2) {
    swapParentsAndChildren(node1, node1, node2, node2);
  }
  return [node1, node2];
}

/** Replaces a node with its children. */
export function unwrap(outerNode: Node, innerNode: Node = outerNode) {
  const parent = outerNode.parentNode;
  if (parent === null) {
    throw new Error('You cannot unwrap a parentless node.');
  }
  while (true) {
    const child = innerNode.firstChild;
    if (child === null) {
      break;
    }
    parent.insertBefore(child, outerNode);
  }
  parent.removeChild(outerNode);
  return parent;
}

/**
 * Accepts 2 arrays of wrapper chains (elements containing only the next
 * element in the list as their sole child) and swaps them in the DOM:
 */
export function swapWraps(wraps1: Node[], wraps2: Node[]) {
  const outer1 = wraps1[0];
  const inner1 = wraps1[wraps1.length - 1];
  const outer2 = wraps2[0];
  const inner2 = wraps2[wraps2.length - 1];

  /* If an empty array is given for either wrapping, unwrap the other one.
   * This is done because otherwise some parameters to swapParentsAndChildren
   * would be undefined, which would cause an error. The reason we allow
   * empty arrays at all is because that is the best way to isomorphize the
   * action of unwrapping something while optionally replacing those wrappings. */
  if (wraps1.length === 0) {
    if (outer2 && DOMT.isChildNode(outer2)) {
      unwrap(outer2, inner2);
    }
  } else if (wraps2.length === 0) {
    if (outer1 && DOMT.isChildNode(outer1)) {
      unwrap(outer1, inner1);
    }
  } else {
    swapParentsAndChildren(outer1, inner1, outer2, inner2);
  }
  return [wraps1, wraps2];
}

/** Inserts a wrapper node between a given node and its parent: */
export function wrap(node: Node, wrapper: DOMT.AppendableNode) {
  const parent = node.parentElement;
  if (parent !== null) {
    parent.insertBefore(wrapper, node);
  }
  wrapper.appendChild(node);
  return wrapper;
}

/** Inserts a wrapper node between a given node and its children: */
export function wrapInner(node: DOMT.AppendableNode, wrapper: DOMT.AppendableNode) {
  transferChildren({from: node, to: wrapper});
  node.appendChild(wrapper);
  return node;
}


/** Returns an iterable with the same path as a NodeIterator. */
export function* iterableNodeIter(
  root: Node, whatToShow?: number, filter?: NodeFilter
): Iterable<Node> {
  const nodeIter = document.createNodeIterator(root, whatToShow, filter);
  while (true) {
    const next = nodeIter.nextNode();
    if (next === null) {
      break;
    }
    yield next;
  }
}
/**
 * Returns an iterator over all text nodes which are descendants to all
 * given root nodes.
 */
export function* textDescendantsIter(roots: Iterable<Node>): Iterable<Text> {
  /* Since roots could conceivably contain other roots, we need some way to
   * avoid yielding the same text node twice: */
  const alreadyYieldedNodes = new WeakSet();
  for (const root of roots) {
    for (const text of iterableNodeIter(root, NodeFilter.SHOW_TEXT)) {
      if (alreadyYieldedNodes.has(text)) {
        continue;
      }
      alreadyYieldedNodes.add(text);
      yield text as Text;
    }
  }
}
/**
 * Returns an iterator over all text nodes which are children to all given
 * root nodes.
 */
export function* textChildrenIter(parents: Iterable<Node>): Iterable<Text> {
  for (const parent of parents) {
    for (const child of parent.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        yield child as Text;
      }
    }
  }
}


/**
 * An object specifying a modified selection. Used with selectNodes.
 */
export interface ComplexSelection {
  root: string;
  modifier: string;
}
/**
 * Returns an array of HTML Elements based on the given selector. The selector
 * may be a CSS Selector, a function, or an object with properties that
 * modify a root selector. Returns an iterable.
 */
export function selectNodes(
  root: DOMT.AppendableNode,
  selector: string|ComplexSelection
): Iterable<Node> {
  if (typeof selector === 'string') {
    /* Special handling for getting all text nodes, which cannot be done
    * using CSS selectors since they can't select text nodes at all: */
    if (selector === '#text') {
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
