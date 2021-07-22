import ts from "typescript";

export const enum IterationTypes {
    FILTER,
    MAP,
    REDUCE,
    FOREACH
}

const stringToIterationType: Record<string, IterationTypes> = {
    "filter": IterationTypes.FILTER,
    "map": IterationTypes.MAP,
    "reduce": IterationTypes.REDUCE,
    "forEach": IterationTypes.FOREACH
};

export interface Iteration {
    type: IterationTypes,
    args: ts.NodeArray<ts.Expression>
}

export interface ArrayIteration {
    iterations: Array<Iteration>,
    array: ts.Node,
    getsLength: boolean
}

export class ZeroCostTransformer {
    ctx: ts.TransformationContext
    types: ts.TypeChecker
    boundVisitor: (node: ts.Node) => ts.Node|undefined
    constructor(types: ts.TypeChecker, ctx: ts.TransformationContext) {
        this.types = types;
        this.ctx = ctx;
        this.boundVisitor = this.visitor.bind(this);
    }

    run(node: ts.Node) : ts.Node {
        return ts.visitNode(node, this.boundVisitor);
    }

    visitor(node: ts.Node) : ts.Node|undefined {
        const iter = this.extractIterations(node);
        if (iter) {
            console.log(iter);
            return this.ctx.factory.createNull();
        }
        return ts.visitEachChild(node, this.boundVisitor, this.ctx);
    }

    extractIterations(node: ts.Node) : ArrayIteration|boolean {
        let lastExp: ts.Node = node; 
        let getsLength = false;
        if (ts.isPropertyAccessExpression(node) && node.name.text === "length") {
            getsLength = true;
            lastExp = node.expression;
        }
        if (!ts.isCallExpression(lastExp)) return false;
        const methods: Array<Iteration> = [];
        while (lastExp) {
            if (ts.isCallExpression(lastExp)) {
                const args = lastExp.arguments;
                lastExp = lastExp.expression;
                if (ts.isPropertyAccessExpression(lastExp)) {
                    const type = stringToIterationType[lastExp.name.text];
                    if (type === undefined) return false;
                    methods.push({ type, args });
                }
            }
            else if (ts.isPropertyAccessExpression(lastExp)) {
                const type = this.types.getTypeAtLocation(lastExp).symbol;
                if (type.escapedName === "Array") {
                    return {
                        iterations: methods,
                        array: lastExp,
                        getsLength
                    };
                }
                lastExp = lastExp.expression;
            }
            else {
                const type = this.types.getTypeAtLocation(lastExp).symbol;
                if (type.escapedName === "Array") {
                    return {
                        iterations: methods,
                        array: lastExp,
                        getsLength
                    };
                }
                return false;
            }
        }
        return false;
    }

}