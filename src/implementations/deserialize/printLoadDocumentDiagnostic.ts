import { printSchemaSchemaError } from "./printSchemaSchemaError"
import { printDeserializationDiagnostic } from "./printDeserializeDiagnostic"
import { LoadDocumentDiagnostic } from "../../interfaces/deserialize/LoadDocumentDiagnostic"
import { printRange } from "../../generic"

function assertUnreachable<RT>(_x: never): RT {
	throw new Error("unreachable")
}

export function printLoadDocumentDiagnostic(loadDiagnostic: LoadDocumentDiagnostic): string {
	switch (loadDiagnostic.type[0]) {
		case "deserialization": {
			const $ = loadDiagnostic.type[1]
			return `${printDeserializationDiagnostic($.data)} @ ${printRange($.range)}`
		}
		case "schema retrieval": {
			const $ = loadDiagnostic.type[1]
			switch ($.issue[0]) {
				case "error in external schema": {
					const $$ = $.issue[1]
					return `error in external schema: ${printSchemaSchemaError($$)}`
				}
				case "found both external and internal schema. ignoring internal schema": {
					return `found both external and internal schema. ignoring internal schema`
				}
				case "missing schema": {
					return `missing schema`
				}
				case "no valid schema": {
					return `no valid schema`
				}
				case "unknown retrieval error": {
					const $$ = $.issue[1]
					return `unknown retrieval error: ${$$.description}`
				}
				case "validating schema file against internal schema": {
					return `this is the directory's schema file. It is validated against its own internal schema`
				}
				default:
					return assertUnreachable($.issue[0])
			}
		}
		case "structure": {
			const $ = loadDiagnostic.type[1]
			return $.message
		}
		case "validation": {
			const $ = loadDiagnostic.type[1]
			return `${$.message} @ ${printRange($.range)}`
		}
		default:
			return assertUnreachable(loadDiagnostic.type[0])
	}
}
