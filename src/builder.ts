/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as ts from "typescript";
import { ArrayIteration, IterationTypes, ZeroCostTransformer } from "./transformer";

export interface LoopBodyEntry {
    addedBy: IterationTypes,
    fn?: ts.Expression,
    statement: ts.ExpressionStatement|ts.Statement
}

export function build(arrIter: ArrayIteration, transformer: ZeroCostTransformer, defaultResItem?: ts.Identifier) : [Array<ts.Statement>, ts.Identifier] {
    const res: Array<ts.Statement> = [];
    const factory = transformer.ctx.factory;
    const i = factory.createUniqueName("i");
    const arrLen = factory.createUniqueName("arrLen");
    const item = factory.createUniqueName("arrItem");
    const resItem = defaultResItem || factory.createUniqueName("res"); 
    const lastIter = arrIter.iterations[arrIter.iterations.length - 1];
    let resInitializor;

    if (lastIter.type === IterationTypes.JOIN) resInitializor = factory.createStringLiteral("");
    else if (lastIter.type === IterationTypes.FOREACH) resInitializor = undefined;
    else if (arrIter.getsLength) resInitializor = factory.createNumericLiteral(0);
    else resInitializor = factory.createArrayLiteralExpression();

    res.push(factory.createVariableStatement(undefined, factory.createVariableDeclarationList([
        factory.createVariableDeclaration(arrLen, undefined, undefined, factory.createPropertyAccessExpression(arrIter.array, "length")),
        factory.createVariableDeclaration(item, undefined, undefined, undefined),
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
                const fn = editFunctions(transformer, iter.args[0], true, i, factory.createElementAccessExpression(arrIter.array, i)) as ts.Expression;
                loopBody.pop();
                loopBody.push({ fn, addedBy: IterationTypes.MAP, statement: factory.createExpressionStatement(factory.createBinaryExpression(item, ts.SyntaxKind.EqualsToken, fn)) });
            } else {
                const fn = editFunctions(transformer, iter.args[0], true, i, item) as ts.Expression;
                loopBody.push({ fn, addedBy: IterationTypes.MAP, statement: factory.createExpressionStatement(factory.createBinaryExpression(item, ts.SyntaxKind.EqualsToken, fn)) });
            }
            break;
        }
        case IterationTypes.FILTER: {
            const fn = editFunctions(transformer, iter.args[0], true, i, item) as ts.Expression;
            loopBody.push({ addedBy: IterationTypes.FILTER, statement: factory.createIfStatement(factory.createPrefixUnaryExpression(ts.SyntaxKind.ExclamationToken, fn), factory.createContinueStatement())});
            break;
        }
        case IterationTypes.FOREACH: {
            const fn = editFunctions(transformer, iter.args[0], false, i, item);
            if ((fn instanceof Array)) loopBody.push(...fn.map(func => ({addedBy: IterationTypes.FOREACH, statement: func})));
            else loopBody.push({addedBy: IterationTypes.FOREACH, statement: factory.createExpressionStatement(fn)});
        }
        }
    }

    if (lastIter.type !== IterationTypes.FOREACH) {
        let thingToPush: ts.Expression = item;
        const lastStmt = loopBody[loopBody.length - 1]!;
        if (lastStmt.addedBy === IterationTypes.MAP) {
            loopBody.pop();
            thingToPush = lastStmt!.fn!;
        }

        if (lastIter.type === IterationTypes.REDUCE) {
            const defaultVal = lastIter.args[1];
            if (defaultVal) resInitializor = defaultVal;
            else resInitializor = undefined;
            const fn = editFunctions(transformer, lastIter.args[0], true, i, thingToPush, resItem) as ts.Expression;
            loopBody.push({addedBy: IterationTypes.REDUCE, fn, statement: factory.createExpressionStatement(factory.createAssignment(resItem, fn))});
        }
    
        else if (lastIter.type === IterationTypes.JOIN) {
            loopBody.push({addedBy: IterationTypes.JOIN, statement: 
            factory.createExpressionStatement(
                factory.createBinaryExpression(resItem, ts.SyntaxKind.PlusEqualsToken, 
                    factory.createBinaryExpression(thingToPush, ts.SyntaxKind.PlusToken, factory.createConditionalExpression(
                        factory.createBinaryExpression(i, ts.SyntaxKind.EqualsEqualsEqualsToken, factory.createBinaryExpression(arrLen, ts.SyntaxKind.MinusToken, factory.createNumericLiteral(1))),
                        undefined, factory.createStringLiteral(""), undefined, lastIter.args[0]
                    )))
            )});
        }
        else if (arrIter.getsLength) {
            loopBody.push({addedBy: IterationTypes.DEFAULT, statement: factory.createExpressionStatement(factory.createPostfixIncrement(resItem))});
        } else {
            loopBody.push({ addedBy: IterationTypes.DEFAULT, statement: factory.createExpressionStatement(factory.createCallExpression(
                factory.createPropertyAccessExpression(
                    resItem,
                    "push"
                ),
                undefined,
                [thingToPush]
            ))});
        }
    }
    res.push(factory.createVariableStatement(undefined, factory.createVariableDeclarationList([factory.createVariableDeclaration(resItem, undefined, undefined, resInitializor)])));
    res.push(factory.updateForStatement(loop, loop.initializer, loop.condition, loop.incrementor, factory.createBlock(loopBody.map(b => b.statement), true)));
    return [res, resItem];
}

export function editFunctions(transformer: ZeroCostTransformer, fn: ts.Expression, wrap: boolean, ...argsArr: Array<ts.Expression>) : ts.Expression|ts.NodeArray<ts.Statement> {
    if (!ts.isArrowFunction(fn)) return transformer.ctx.factory.createCallExpression(fn, undefined, argsArr.reverse());
    const replacements = new Map();
    for (const param of fn.parameters) {
        if (ts.isIdentifier(param.name)) replacements.set(param.name.text, argsArr.pop());
    }
    const visitor = (node: ts.Node): ts.Node|undefined => {
        if (ts.isIdentifier(node) && replacements.has(node.text)) return replacements.get(node.text);
        return ts.visitEachChild(node, visitor, transformer.ctx);
    };
    const newFnBod = ts.visitEachChild(fn, visitor, transformer.ctx);
    if ("statements" in newFnBod.body) return wrap ? transformer.ctx.factory.createImmediatelyInvokedArrowFunction(newFnBod.body.statements) : newFnBod.body.statements;
    return newFnBod.body;
}