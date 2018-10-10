//???
(function t_swapNodes() {
  const p = Santi.createEl('p', ['Hello world!']);
  const h1 = Santi.createEl('h1', ['Foo']);
  const div = Santi.createEl('div', [p, h1]);
  Santi.swapNodes(p, h1);
  console.assert(div.firstChild === h1 && div.children[1] === p,
    `Santi.swapNodes failed to re-append children.`, div.outerHTML
  );
  const pre = Santi.createEl('pre');
  Santi.swapNodes(p, pre);
  console.assert(
    pre.innerText === 'Foo' && pre.parentElement === div &&
    p.parentElement === null,
    `Santi.swapNodes failed to swap in foreign child.`, div.outerHTML
  );
}());
