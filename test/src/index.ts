
class A {
    arr: Array<number>
    constructor() {
        this.arr = [];
        this.arr.filter(a => a * 2 === 0);
        [1, 2, 3, 4].filter(a => a * 2 === 0).map(el => el * 2).length;
    }

}
