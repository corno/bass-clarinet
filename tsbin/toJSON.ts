import {
    createJSONFormatter,
} from "astn-core";
import { formatCLI } from "./formatCLI";

formatCLI(
    createJSONFormatter("   ", "\r\n"),
    "\r\n",
)