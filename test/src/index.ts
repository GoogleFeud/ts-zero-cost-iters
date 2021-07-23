
const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const res = array.filter((el: number) => el % 2 === 0).map(el => (el * 2) + 1).reduce((acc, val) => acc + val, 0);
console.log(res);