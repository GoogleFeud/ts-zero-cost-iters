import * as ts from "typescript";
import { ArrayIteration, IterationTypes, ZeroCostTransformer } from "./transformer";


export function build(arrIter: ArrayIteration, transformer: ZeroCostTransformer) : Array<ts.Node> {
    const res = [];
    let lastOp: number|undefined;
    const i = transformer.ctx.factory.createUniqueName("i");
    const item = transformer.ctx.factory.createUniqueName("arrItem");
    for (const iter of arrIter.iterations) {
        switch (iter.type) {
        case IterationTypes.MAP: {
            const fn = editFunctions(transformer, iter.args[0] as ts.ArrowFunction, item, i);
            res.push(transformer.ctx.factory.createBinaryExpression(item, ts.SyntaxKind.EqualsToken, fn));
        }
        }
        lastOp = iter.type;
    }
    return res;
}

export function editFunctions(transformer: ZeroCostTransformer, fn: ts.ArrowFunction, ...argsArr: Array<ts.Node>) : ts.Expression {
    const replacements = new Map();
    for (const param of fn.parameters) {
        if (ts.isIdentifier(param.name)) replacements.set(param.name.text, argsArr.pop());
    }
    const visitor = (node: ts.Node): ts.Node|undefined => {
        if (ts.isIdentifier(node) && replacements.has(node.text)) return replacements.get(node.text);
        return ts.visitEachChild(node, visitor, transformer.ctx);
    };
    const newFnBod = ts.visitEachChild(fn, visitor, transformer.ctx).body;
    if ("statements" in newFnBod) return transformer.ctx.factory.createParenthesizedExpression(transformer.ctx.factory.createArrowFunction(
        undefined,
        undefined,
        [],
        undefined,
        undefined,
        newFnBod
    ));
    return newFnBod;
}