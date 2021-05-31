import {
    createJSONFormatter,
} from "../src/formatting";
import { formatCLI } from "./formatCLI";

formatCLI(
    createJSONFormatter("   ", "\r\n"),
)