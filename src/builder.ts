import * as ts from "typescript";
import { ArrayIteration, IterationTypes, ZeroCostTransformer } from "./transformer";

export interface LoopBodyEntry {
    addedBy: IterationTypes,
    statement: ts.ExpressionStatement
}

export function build(arrIter: ArrayIteration, transformer: ZeroCostTransformer) : Array<ts.Statement> {
    const res: Array<ts.Statement> = [];
    const factory = transformer.ctx.factory;
    const i = factory.createUniqueName("i");
    const arrLen = factory.createUniqueName("arrLen");
    const item = factory.createUniqueName("arrItem");
    res.push(factory.createVariableStatement(undefined, factory.createVariableDeclarationList([
        factory.createVariableDeclaration(arrLen, undefined, undefined, factory.createPropertyAccessExpression(arrIter.array, "length")),
        factory.createVariableDeclaration(item, undefined, undefined, undefined)
    ])));
    const loop = factory.createForStatement(factory.createVariableDeclarationList([
        factory.createVariableDeclaration(i, undefined, undefined, factory.createNumericLiteral(0))]),
        factory.createBinaryExpression(i, ts.SyntaxKind.LessThanToken, arrLen),
        factory.createPostfixIncrement(i),
        factory.createBlock([])
    );
    const loopBody: Array<LoopBodyEntry> = [
        { addedBy: IterationTypes.DEFAULT, statement: factory.createExpressionStatement(factory.createBinaryExpression(item, ts.SyntaxKind.EqualsToken, factory.createElementAccessExpression(arrIter.array, i))) }
    ];
    for (const iter of arrIter.iterations) {
        switch (iter.type) {
        case IterationTypes.MAP: {
            if (loopBody[loopBody.length - 1]?.addedBy === IterationTypes.DEFAULT) {
                const fn = editFunctions(transformer, iter.args[0] as ts.ArrowFunction, i, factory.createElementAccessExpression(arrIter.array, i));
                loopBody.pop();
                loopBody.push({addedBy: IterationTypes.MAP, statement: factory.createExpressionStatement(factory.createBinaryExpression(item, ts.SyntaxKind.EqualsToken, fn))});
                continue;
            }
            const fn = editFunctions(transformer, iter.args[0] as ts.ArrowFunction, i, factory.createElementAccessExpression(arrIter.array, i));
            loopBody.push({addedBy: IterationTypes.MAP, statement: factory.createExpressionStatement(factory.createBinaryExpression(item, ts.SyntaxKind.EqualsToken, fn))});
        }
        }
    }
    res.push(factory.updateForStatement(loop, loop.initializer, loop.condition, loop.incrementor, factory.createBlock(loopBody.map(b => b.statement), true)));
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
    const newFnBod = ts.visitEachChild(fn, visitor, transformer.ctx);
    if ("statements" in newFnBod.body) return newFnBod;
    return newFnBod.body;
}