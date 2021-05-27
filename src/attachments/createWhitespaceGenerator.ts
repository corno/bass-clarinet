// /*eslint
// 	complexity: off
// */
// // import * as p from "pareto"
// import * as h from "../handlers"
// import { createAnnotations, StackContext } from "./createAnnotations"

// type OutTokenAnnotation<InTokenAnnotation> = {
// 	whitespaceBefore: string
// 	token: string
// 	whitespaceAfter: string
// 	inAnnotation: InTokenAnnotation
// }
// type OutNonTokenAnnotation<InNonTokenAnnotation> = {
// 	whitespace: string
// 	inAnnotation: InNonTokenAnnotation
// }


// export function createWhitespaceGenerator<InTokenAnnotation, InNonTokenAnnotation>(
// 	indentationString: string,
// 	downstreamHandler: h.RequiredValueHandler<OutTokenAnnotation<InTokenAnnotation>, OutNonTokenAnnotation<InNonTokenAnnotation>>
// ): h.RequiredValueHandler<InTokenAnnotation, InNonTokenAnnotation> {

// 	function createIndentation(context: StackContext) {
// 		let indentation = ""
// 		for (let i = 0; i !== context.objectDepth; i += 1) {
// 			indentation += indentationString
// 		}
// 		return indentation
// 	}
// 	return createAnnotations(
// 		downstreamHandler,
// 		{
// 			objectBegin: data => {
// 				return {
// 					whitespaceBefore: " ",
// 					token: data.type[0] === "verbose type" ? "(" : "{",
// 					whitespaceAfter: "",
// 					inAnnotation: data.annotation,
// 				}
// 			},
// 			property: (data, context, _isFirst, objectBeginData) => {
// 				return {
// 					whitespaceBefore: `${createIndentation(context)}${indentationString}`,
// 					token: objectBeginData.type[0] === "verbose type" ? `'${data.key}'` : `"${data.key}"`, //FIX proper escaping
// 					whitespaceAfter: ":",
// 					inAnnotation: data.annotation,
// 				}
// 			},
// 			objectEnd: (endData, context, data) => {
// 				return {
// 					whitespaceBefore: `${createIndentation(context)}`,
// 					token: data.type[0] === "verbose type" ? ")" : "}",
// 					whitespaceAfter: "",
// 					inAnnotation: endData.annotation,
// 				}
// 			},
// 			arrayBegin: data => {
// 				return {
// 					whitespaceBefore: "",
// 					token: data.type[0] === "shorthand type" ? "<" : "[",
// 					whitespaceAfter: "",
// 					inAnnotation: data.annotation,
// 				}
// 			},
// 			element: elementData => {
// 				return {
// 					whitespace: "FIXME",
// 					inAnnotation: elementData.annotation,
// 				}
// 			},
// 			arrayEnd: (endData, _context, data) => {
// 				return {
// 					whitespaceBefore: " ",
// 					token: data.type[0] === "shorthand type" ? ">" : "]",
// 					whitespaceAfter: "",
// 					inAnnotation: endData.annotation,
// 				}
// 			},
// 			simpleValue: data => {
// 				return {
// 					whitespaceBefore: "",
// 					token: `${data.wrapper[0]}${data.value}${data.wrapper[0]}`, //FIX escaping
// 					whitespaceAfter: "",
// 					inAnnotation: data.annotation,
// 				}
// 			},
// 			taggedUnionBegin: data => {
// 				return {
// 					whitespaceBefore: "",
// 					token: "| '${}'",
// 					whitespaceAfter: "",
// 					inAnnotation: data.annotation,
// 				}
// 			},
// 			option: optionData => {
// 				return {
// 					whitespaceBefore: "",
// 					token: "",
// 					whitespaceAfter: "",
// 					inAnnotation: optionData.annotation,
// 				}
// 			},
// 			taggedUntionEnd: data => {
// 				return {
// 					whitespace: "FIXME",
// 					inAnnotation: data.annotation,
// 				}
// 			},
// 		},
// 	)
// }