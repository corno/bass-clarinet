import { createJSONFormatter } from "../src/formatting/createJSONFormatter";
import { formatCLI } from "./formatCLI";

formatCLI(createJSONFormatter("   ", "\r\n"))