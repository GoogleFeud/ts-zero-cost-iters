
import {performance} from "perf_hooks";


const array = Array.from({length: 1000}, (_, item) => item + 1);



const before = performance.now();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const result = array.filter((el: number) => el % 2 === 0).length;
console.log(performance.now() - before);
