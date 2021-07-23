# ts-zero-cost-iters

`ts-zero-cost-iters` is a typescript plugin which combines array functions like `filter`, `map` and `reduce` into a single for loop. Example:

```ts
const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const result = array.filter(num => num % 2 === 0).map(num => num * 2).join("+");
```

to:

```js
const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
var arrLen_1 = array.length, arrItem_1, i_1 = 0;
var result = "";
for (; i_1 < arrLen_1; i_1++) {
    arrItem_1 = array[i_1];
    if (!(arrItem_1 % 2 === 0))
        continue;
    result += arrItem_1 * 2 + (i_1 === arrLen_1 - 1 ? "" : "+");
}
```

## Install

You need the `ttypescript` package in order to use this:
```npm i ttypescript```

After that put this in your tsconfig.json:

```
"compilerOptions": {
//... other options
"plugins": [
        { "transform": "ts-macros" }
]
}
```

And run your code with `ttsc`

## ts-zero-cost-iters in-depth

### .length

If the chain ends with a `.length`, then the generated output will NEVER create a new array, it's just going to count the elements.

```ts
const result = array.filter(num => num % 2 === 0).length;
```

```js
var arrLen_1 = array.length, arrItem_1, i_1 = 0;
var result = 0;
for (; i_1 < arrLen_1; i_1++) {
    arrItem_1 = array[i_1];
    if (!(arrItem_1 % 2 === 0))
        continue;
    result++;
}
```