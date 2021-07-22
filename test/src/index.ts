
const array = Array.from({length: 10}, (_, i) => i + 1) as number[];

const res = array.filter(el => el % 2 === 0).map(el => (el * 2) + 1);
console.log(res);