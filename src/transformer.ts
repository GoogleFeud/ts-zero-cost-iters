import ts from "typescript";

export class ZeroCostTransformer {
    ctx: ts.TransformationContext
    boundVisitor: (node: ts.Node) => ts.Node|undefined
    constructor(ctx: ts.TransformationContext) {
        this.ctx = ctx;
        this.boundVisitor = this.visitor.bind(this);
    }

    run(node: ts.Node) : ts.Node {
        return ts.visitNode(node, this.boundVisitor);
    }

    visitor(node: ts.Node) : ts.Node|undefined {
        console.log("Node with kind: ", node.kind);
        return ts.visitEachChild(node, this.boundVisitor, this.ctx);
    }

}