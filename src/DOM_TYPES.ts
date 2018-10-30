/**
 * Section: Custom types and corresponding guards:
 */
export type AppendableNode = (Node&ParentNode) | Element | DocumentFragment;
export function isAppendable(node: Node): node is AppendableNode {
    return (
      isChildNode(node) ||
      node instanceof Element ||
      node instanceof DocumentFragment
    );
}

export type NodeTest = (node: Node) => boolean;

export type NodeExpander = (node: Node) => Node[];

/**
 * Section: Solo Type Guards:
 */
export function isChildNode(node: Node): node is Node&ChildNode {
  return (node.parentNode !== null);
}

export function isParentNode(node: Node): node is Node&ParentNode {
  return (node.firstChild !== null);
}

export function isIterable<T>(collection: any): collection is Iterable<T> {
  return (Symbol.iterator in collection);
}
