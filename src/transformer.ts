import ts from "typescript";
import {build} from "./builder";

export const enum IterationTypes {
    DEFAULT,
    FILTER,
    MAP,
    REDUCE,
    FOREACH,
    JOIN
}

const stringToIterationType: Record<string, IterationTypes> = {
    "filter": IterationTypes.FILTER,
    "map": IterationTypes.MAP,
    "reduce": IterationTypes.REDUCE,
    "forEach": IterationTypes.FOREACH,
    "join": IterationTypes.JOIN
};

export interface Iteration {
    type: IterationTypes,
    args: ts.NodeArray<ts.Expression>
}

export interface ArrayIteration {
    iterations: Array<Iteration>,
    array: ts.Expression,
    getsLength: boolean
}

export class ZeroCostTransformer {
    ctx: ts.TransformationContext
    types: ts.TypeChecker
    boundVisitor: (node: ts.Node) => ts.Node|Array<ts.Node>|undefined
    constructor(types: ts.TypeChecker, ctx: ts.TransformationContext) {
        this.types = types;
        this.ctx = ctx;
        this.boundVisitor = this.visitor.bind(this);
    }

    run(node: ts.Node) : ts.Node {
        return ts.visitNode(node, this.boundVisitor);
    }

    visitor(node: ts.Node) : ts.Node|Array<ts.Node>|undefined {
        if (ts.isExpressionStatement(node)) {
            const iter = this.extractIterations(node.expression);
            if (iter) return build(iter, this);
            return ts.visitEachChild(node, this.boundVisitor, this.ctx);
        } else {
            const iter = this.extractIterations(node);
            if (iter) return this.ctx.factory.createImmediatelyInvokedArrowFunction(build(iter, this));
            return ts.visitEachChild(node, this.boundVisitor, this.ctx);
        }
    }

    extractIterations(node: ts.Node) : ArrayIteration|false {
        let lastExp: ts.Expression = node as ts.Expression; 
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