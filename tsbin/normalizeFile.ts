import * as astn from "../src"
import { formatCLI } from "./formatCLI";

formatCLI(
    astn.createASTNNormalizer("    ", "\r\n")
)