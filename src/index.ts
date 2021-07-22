

import * as ts from "typescript";
import { ZeroCostTransformer } from "./transformer";

export default (program: ts.Program): ts.TransformerFactory<ts.Node> => ctx => {
    return firstNode => {
        return new ZeroCostTransformer(program.getTypeChecker(), ctx).run(firstNode);
    };
};