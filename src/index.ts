

import * as ts from "typescript";
import { ZeroCostTransformer } from "./transformer";

export default (): ts.TransformerFactory<ts.Node> => ctx => {
    return firstNode => {
        return new ZeroCostTransformer(ctx).run(firstNode);
    };
};