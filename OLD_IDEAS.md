## Operations
There are several basic operations which santi.js performs in order to transform
HTML markup:

* **Remove**: Remove an element.
* **Replace**: Take a given element and replace it with a new element, removing
  any children.
* **Wrap**: Take a given element, and wrap it in a new one.
* **Unwrap**: Append all of an element's children to its parent. Then, remove it.
* **Rewrap**: Take a given element, replace it with a new one, and move all of
  its children to the replacement.
* **Coalesce**: Take a given element and its next sibling, replace them with a
  new element (or either of the existing elements) and move all of their children
  to the new element.
* **Mutate**: Don't directly do anything with the element. Instead, allow the
  passed call-back function to apply any mutations or side-effects on its own.

The order in which these operations are applied can be configured. New procedures
also be defined and added.

## 10/3/2018
Okay here's how this should really work. It should be as idiomatic as saying "map
from this DOM hierarchy to this other one" e.g. p > span style bold --> p > strong

You could use just an array of css-selectors or add tests in the middle to be more specific.

E.g. `rule(['p', {sel:'span', test:e=>Number(getComputedStyle(e).fontWeight) >= 600}], ['p', 'strong'])`

Something like that. Maybe the first parameter should just be either a single css selector (e.g. 'p>span')
or a function that returns an element/array of elements. The second parameter can be an array of tagnames
or elements or a function that returns one of those w/ some parameters.

## 10/5/2018
Rules have the following syntax:
```js
{
  select: selector,
  [except: filter,]
  [onlyIf: filter,]
  operation: operationName,
  [context: {contextObject}]
}
```
e.g.
```js
{
  select: 'iframe',
  except: iframe=>(new URL(iframe.src).host === 'www.youtube.com'),
  operation: 'replace',
  context: {
    with: iframe=>Santi.createEl('a', undefined, {href: iframe.src})
  }
}
```

There are also two types of simplified syntaxes: active and relative.

Active rules are so named because they represent some action being performed
directly on the selected element(s). They look like this:
```js
{
  operationName: selector,
  [filters],
  [contextKey: contextParameter]
}
```
e.g.
```js
{
  replace: 'iframe',
  except: iframe=>(new URL(iframe.src).host === 'www.youtube.com'),
  with: iframe=>Santi.createEl('a', undefined, {href: iframe.src})
}
```

**** or maybe this should be
[rules...,
  replace('iframe', {with: iframe=>Santi.createEl('a' etc etc etc...)}), idk =(
...rules]


Which replaces all non-YouTube iframes with links.

The default active operations are:
* replace
* replace
* wrap
* rewrap
* unwrap

Relative rules are so named because they represent some action being with the
selected element(s) as their reference point. This often involves mutating
the given element. They look like this:
```js
{
  select: selector,
  operationName: contextObject or contextParameter
}
```
e.g.
```js
{
  select: 'span',
  allowStyles: ['color']
}
```
The default relative operations are:
* allowStyles
* removeStyles
* allowAttributes
* removeAttributes

Note that, while any rule can be written in the general syntax, only operations
explicitly defined as active or relative can be used in active or relative
rules, respectively.
