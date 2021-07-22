import * as ts from "typescript";
import { ArrayIteration, IterationTypes, ZeroCostTransformer } from "./transformer";

export interface LoopBodyEntry {
    addedBy: IterationTypes,
    fn?: ts.Expression,
    statement: ts.ExpressionStatement|ts.Statement
}

export function build(arrIter: ArrayIteration, transformer: ZeroCostTransformer) : [Array<ts.Statement>, ts.Identifier] {
    const res: Array<ts.Statement> = [];
    const factory = transformer.ctx.factory;
    const i = factory.createUniqueName("i");
    const arrLen = factory.createUniqueName("arrLen");
    const item = factory.createUniqueName("arrItem");
    const resItem = factory.createUniqueName("res"); 
    if (!arrIter.getsLength) factory.createVariableDeclaration(resItem, undefined, undefined, factory.createArrayLiteralExpression());
    res.push(factory.createVariableStatement(undefined, factory.createVariableDeclarationList([
        factory.createVariableDeclaration(arrLen, undefined, undefined, factory.createPropertyAccessExpression(arrIter.array, "length")),
        factory.createVariableDeclaration(item, undefined, undefined, undefined),
        factory.createVariableDeclaration(resItem, undefined, undefined, !arrIter.getsLength ? factory.createArrayLiteralExpression():factory.createNumericLiteral(0)),
        factory.createVariableDeclaration(i, undefined, undefined, factory.createNumericLiteral(0))
    ])));
    const loop = factory.createForStatement(undefined,
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
                    loopBody.push({ fn, addedBy: IterationTypes.MAP, statement: factory.createExpressionStatement(factory.createBinaryExpression(item, ts.SyntaxKind.EqualsToken, fn)) });
                } else {
                const fn = editFunctions(transformer, iter.args[0] as ts.ArrowFunction, i, item);
                loopBody.push({ fn, addedBy: IterationTypes.MAP, statement: factory.createExpressionStatement(factory.createBinaryExpression(item, ts.SyntaxKind.EqualsToken, fn)) });
                }
                break;
            }
            case IterationTypes.FILTER: {
                const fn = editFunctions(transformer, iter.args[0] as ts.ArrowFunction, i, item);
                loopBody.push({ addedBy: IterationTypes.FILTER, statement: factory.createIfStatement(factory.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken, fn), factory.createContinueStatement())});
            }
        }
    }
    if (arrIter.getsLength) {
        loopBody.push({addedBy: IterationTypes.DEFAULT, statement: factory.createExpressionStatement(factory.createPostfixIncrement(resItem))});
    } else {
        let thingToPush: ts.Expression = item;
        const lastStmt = loopBody[loopBody.length - 1]!;
        if (lastStmt.addedBy === IterationTypes.MAP) {
            loopBody.pop();
            thingToPush = lastStmt!.fn!;
        }
        loopBody.push({ addedBy: IterationTypes.DEFAULT, statement: factory.createExpressionStatement(factory.createCallExpression(
            factory.createPropertyAccessExpression(
              resItem,
              "push"
            ),
            undefined,
            [thingToPush]
        ))});
    }
    res.push(factory.updateForStatement(loop, loop.initializer, loop.condition, loop.incrementor, factory.createBlock(loopBody.map(b => b.statement), true)));
    return [res, resItem];
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