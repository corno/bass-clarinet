import { createASTNFormatter } from "../src/formatting/createASTNFormatter";
import { formatCLI } from "./formatCLI";

formatCLI(createASTNFormatter("    ", "\r\n"))