import * as core from "astn-core"
import { formatCLI } from "./formatCLI";

formatCLI(
    core.createASTNNormalizer("    ", "\r\n"),
    "\r\n",
)