# Santi.js
An HTML Sanitizer designed to take input from noisy sources like Google Docs and
other word processors, and turn it into clean, semantic HTML using a powerful
and highly configurable set of operations and rules.

## Rules
The sanitizer accepts an array of rules. Rules are plain JavaScript objects, and
have the following format:
```js
{
  select: CSS_Selector | selectorObj {
    root: CSS_Selector,
    modifier: selectorMod,
  },
  [[except: filterFunc,
  onlyIf: filterFunc]]
  operationName: operationArgument
}
```
Here are some examples:
```js
{
  select: 'iframe',
  except: iframe=>(new URL(iframe.src).host === 'www.youtube.com'),
  replaceWith: iframe=>Santi.createEl('a', undefined, {href: iframe.src})
}
```
```js
{
  select: 'script',
  remove: true
}
```
```js
{
  select: 'span',
  allowStyles: ['color']

}
```
```js
{
  select: '#text',
  onlyIf: text => /^\s+$/.test(text.data), //Remove empty text nodes
  remove: true
},
```
```js
/* Replace span tags wrapping around text elements with semantic elements
 * based on style: */
{
  select: {
    root: '#text',
    /* "Wraps" refers to elements with only one child. This modifier matches
     * the direct chain of span wrappers containing a given text node. */
    wraps: {direction: 'ancestors', untilNot: 'span'},
  },
  replaceWith: oldWraps=>{
    const newWraps = new Set();
    for (const wrap of oldWraps) {
      const style = getComputedStyle(wrap);
      if (Number(style.fontWeight) >= 600) newWraps.add('strong');
      if (['italic', 'oblique'].contains(style.fontStyle)) newWraps.add('em');
      if (style.textDecoration.contains('underline')) newWraps.add('u');
      if (style.textDecoration.contains('line-through')) newWraps.add('strike');
    }
    return Array.from(newWraps);
  }
}
```

## Pre-Defined Rules
Santi defines some common rules, which can be used by simply adding them by
identity to the rules array. Common examples are:
* Minify - Removes comments and white-space from the input. Note that white-space
  which has a "white-space: pre;" style is not removed.
* Semantify - The definition is shown in the last example above. This replaces
  styled span tags with more specific semantic elements.
