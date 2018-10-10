if (typeof NodeIterator.prototype[Symbol.iterator] !== 'function') {
  NodeIterator.prototype[Symbol.iterator] = function* () {
    while (true) {
      const next = this.nextNode();
      if (next === null) break;
      yield next;
    }
  };
}
