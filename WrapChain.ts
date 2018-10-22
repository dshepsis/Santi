/* Monad for handling nodes isomorphically with nodes directly wrapping around
 * other nodes: */
type AppendableNode = Element | DocumentFragment;
function isAppendable(node: Node): node is AppendableNode {
    return (node instanceof Element || node instanceof DocumentFragment);
}
type NodeTest = (node: Node) => boolean;
type NodeExpander = (node: Node) => Node[];

class WrapChain {
  readonly nodes: Node[] = [];
  get length() { return this.nodes.length; }
  get outerNode(): Node|null { return this.nodes[0] || null; }
  get innerNode(): Node|null { return this.nodes[this.length] || null; }
  get parentNode(): Node|null {
    const outer = this.outerNode;
    return (outer === null) ? null : outer.parentNode;
  }
  get childNodes(): NodeList|null {
    const inner = this.innerNode;
    return (inner === null) ? null : inner.childNodes;
  }
  get firstChild(): Node|null {
    const inner = this.innerNode;
    return (inner === null) ? null : inner.firstChild;
  }

  constructor(wraps: Node[]) {
    const allButLastLen = wraps.length - 1;
    for (let i = 0; i < allButLastLen; ++i) {
      const node = wraps[i];
      const numChildren = node.childNodes.length;
      if (numChildren !== 1) {
        throw new TypeError(
          'Node wrap chains must be composed of nodes containing only ' +
          `subsequent nodes. However, the node at index ${i} had ` +
          `${numChildren} children.`
        );
      }
      if (node.firstChild !== wraps[i + 1]) {
        throw new TypeError(
          'Node wrap chains must be composed of nodes containing only ' +
          `subsequent nodes. However, the node at index ${i} had a child ` +
          'not identical to the next node in the given array.'
        );
      }
    }
    this.nodes = wraps;
  }
  static getWrapsAround(node: Node): Node[] {
    /* We read the wrappers inside-out, but want to return them outside-in: */
    const revWrappers = [];
    let nodePtr: Node|null = node;
    while (true) {
      nodePtr = nodePtr.parentNode;
      if (nodePtr === null || nodePtr.childNodes.length !== 1) {
        break;
      }
      revWrappers.push(nodePtr);
    }
    return revWrappers.reverse();
  }
  static getWrapsWithin(node: Node): Node[] {
    const wrappers = [];
    let nodePtr: Node|null = node;
    while (nodePtr.childNodes.length === 1) {
      nodePtr = nodePtr.firstChild;
      if (nodePtr === null) {
        /* Technically, we don't need to check if nodePtr === null, because we
         * already checked that it's parent has one child, but non-null
         * assertions are forbidden by the current tslint rules. */
        break;
      }
      wrappers.push(nodePtr);
    }
    return wrappers;
  }
  static getWraps(
    node: Node,
    direction: string|string[]|NodeExpander,
    options: {
      trim?: NodeTest
    } = {}
  ): Node[] {
    let wraps;
    if (direction === undefined) {
      wraps = [node];
    } else if (typeof direction === 'function') {
      wraps = direction(node);
    } else if (typeof direction === 'string') {
      switch (direction) {
        case 'self':
          wraps = [node]; break;
        case 'around': case 'ancestors':
          wraps = WrapChain.getWrapsAround(node); break;
        case 'within': case 'descendants':
          wraps = WrapChain.getWrapsWithin(node); break;
        default:
          throw new Error(`Unexpected direction string "${direction}"!`);
      }
    } else if (Array.isArray(direction)) {
      /* If given an array of directions, e.g. `['around', 'self']`, give the
       * concatenation of those individual results: */
      wraps = [];
      for (const subDir of direction) {
        const subWraps = WrapChain.getWraps(node, subDir);
        for (const subNode of subWraps) {
          wraps.push(subNode);
        }
      }
    } else {
      throw new TypeError(
        'Wrapping direction must be a function, array, or string.'
      );
    }
    const trim = options.trim;
    if (trim) {
      const length = wraps.length;
      let start, end;
      for (start = 0; start < length; ++start) {
        if (!trim(wraps[start])) {
          break;
        }
      }
      for (end = length - 1; end > start; --end) {
        if (!trim(wraps[end])) {
          break;
        }
      }
      wraps = wraps.slice(start, end + 1);
    }
    return wraps;
  }
  static fromNode(
    node: Node,
    direction: string|string[]|NodeExpander,
    options: {
      trim?: NodeTest
    } = {}
  ): WrapChain {
    const chain = WrapChain.getWraps(node, direction, options);
    return new WrapChain(chain);
  }

  /* Helper functions for isomorphically handling Nodes and NodeWrapChains: */
  static getOuterNode(nodeOrChain: Node|WrapChain) {
    if (nodeOrChain instanceof Node) {
      return nodeOrChain;
    }
    return nodeOrChain.outerNode;
  }
  static getInnerNode(nodeOrChain: Node|WrapChain) {
    if (nodeOrChain instanceof Node) {
      return nodeOrChain;
    }
    return nodeOrChain.innerNode;
  }

  [Symbol.iterator](): IterableIterator<Node> {
    return this.nodes[Symbol.iterator]();
  }
  *elementIter(): IterableIterator<Element> {
    for (const node of this.nodes) {
      if (node instanceof Element) {
        yield node;
      }
    }
  }
  elements(): Element[] {
    return Array.from(this.elementIter());
  }
  canAppendChild(): boolean {
    const inner = this.innerNode;
    return (inner === null) ? false : isAppendable(inner);
  }
  appendChild(newChild: Node|WrapChain): Node {
    const inner = this.innerNode;
    if (inner === null) {
      throw new Error('Cannot append new child to empty WrapChain!');
    }
    const newChildOuter = WrapChain.getOuterNode(newChild);
    if (newChildOuter === null) {
      throw new Error('Cannot append empty WrapChain to this WrapChain!');
    }
    return inner.appendChild(newChildOuter);
  }
  removeChild(child: Node|WrapChain): Node {
    const inner = this.innerNode;
    if (inner === null) {
      throw new Error('Cannot remove child from empty WrapChain!');
    }
    const childOuter = WrapChain.getOuterNode(child);
    if (childOuter === null) {
      throw new Error('Cannot append empty WrapChain!');
    }
    return inner.removeChild(childOuter);
  }
  appendThisTo(parent: Node|WrapChain) {
    const parentInner = WrapChain.getInnerNode(parent);
    if (parentInner === null) {
      throw new Error('Cannot append this WrapChain to empty WrapChain!');
    }
    const outer = this.outerNode;
    if (outer === null) {
      throw new Error('Cannot append this empty WrapChain!');
    }
    return parentInner.appendChild(outer);
  }
}
