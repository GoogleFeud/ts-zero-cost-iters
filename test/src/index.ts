
class A {
    arr: Array<number>
    constructor() {
        this.arr = [];
        [1, 2, 3, 4].filter(a => a * 2 === 0).map(el => el * 2).some(el => el === 4);
    }

}
