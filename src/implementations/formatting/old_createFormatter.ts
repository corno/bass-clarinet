/*eslint
	complexity: off
*/
import * as p from "pareto"
import * as core from "astn-core"
import { Range, Location } from "../../generic/location"
import { ParserAnnotationData } from "../../interfaces"

function assertUnreachable(_x: never) {
	throw new Error("unreachable")
}

type TokenInfo = {
	range: Range
	value: string
}

enum Style {
	root,
	inline,
	block,
}

enum PrecedingTokenType {
	newLine,
	colon,
	pipe,
	option,
	nothing,
	other,
	inlineBlockComment,
}

type PrecedingToken =
	| [PrecedingTokenType.inlineBlockComment]
	| [PrecedingTokenType.newLine, {
		token: TokenInfo
		precededByLineComment: boolean
	}]
	| [PrecedingTokenType.colon]
	| [PrecedingTokenType.pipe]
	| [PrecedingTokenType.option]
	| [PrecedingTokenType.nothing]
	| [PrecedingTokenType.other]

/**
 * this function creates a TextParserEventConsumer that can be attached to a text parser
 * It will call the replace, del and insert callbacks for each place in the text where a reformatting is needed
 */
export function createFormatter(
	indentation: string,
	replace: (
		range: Range,
		newValue: string,
	) => void,
	del: (
		range: Range,
	) => void,
	insert: (
		location: Location,
		newValue: string,
	) => void,
	onEnd: () => p.IValue<null>,
): core.ITreeBuilder<ParserAnnotationData, null, null> {
	let precedingWhitespace: null | TokenInfo = null

	const stack: Style[] = []
	let currentRequiredStyle: Style | null = Style.root
	let precedingToken: PrecedingToken = [PrecedingTokenType.nothing]
	let indentLevel = 0

	function push() {
		stack.push(currentRequiredStyle === null ? Style.inline : currentRequiredStyle)
		currentRequiredStyle = null
	}

	function insertOrReplacePrecedingWhiteSpace(location: Location, value: string) {
		if (precedingWhitespace === null) {
			insert(location, value)
		} else {
			if (precedingWhitespace.value !== value) {
				replace(precedingWhitespace.range, value)
			}
		}
	}

	function ensureSpaceBefore(location: Location) {
		insertOrReplacePrecedingWhiteSpace(location, " ")
	}

	function createExpectedIndentation() {
		let expectedIndentation = ""
		for (let i = 0; i !== indentLevel; i += 1) {
			expectedIndentation += indentation
		}
		return expectedIndentation
	}

	function ensureIndentation(location: Location) {
		insertOrReplacePrecedingWhiteSpace(location, createExpectedIndentation())
	}

	function semanticToken(
		location: Location
	) {
		switch (precedingToken[0]) {
			case PrecedingTokenType.colon: {
				ensureSpaceBefore(location)
				break
			}
			case PrecedingTokenType.inlineBlockComment: {
				ensureSpaceBefore(location)
				break
			}
			case PrecedingTokenType.option: {
				ensureSpaceBefore(location)
				break
			}
			case PrecedingTokenType.nothing: {
				break
			}
			case PrecedingTokenType.other: {
				if (currentRequiredStyle === null) {
					currentRequiredStyle = Style.inline
				}
				switch (currentRequiredStyle) {
					case Style.block: {
						insert(precedingWhitespace ? precedingWhitespace.range.start : location, "\n")
						ensureIndentation(location)
						break
					}
					case Style.inline: {
						ensureSpaceBefore(location)
						break
					}
					case Style.root: {
						break
					}
					default:
						assertUnreachable(currentRequiredStyle)
				}
				break
			}
			case PrecedingTokenType.newLine: {
				if (precedingToken[1].precededByLineComment) {
					ensureIndentation(location)
				} else {
					if (currentRequiredStyle === null) {
						currentRequiredStyle = Style.inline
					}
					switch (currentRequiredStyle) {
						case Style.block: {
							ensureIndentation(location)
							break
						}
						case Style.inline: {
							if (precedingToken[1].precededByLineComment) {
								ensureIndentation(location)
							} else {
								del(precedingToken[1].token.range)
								ensureSpaceBefore(location)
							}
							break
						}
						case Style.root: {
							break
						}
						default:
							assertUnreachable(currentRequiredStyle)
					}
				}
				break
			}
			case PrecedingTokenType.pipe: {
				ensureSpaceBefore(location)
				break
			}
			default:
				assertUnreachable(precedingToken[0])
		}
		precedingWhitespace = null
	}

	function closeToken(location: Location) {
		if (currentRequiredStyle === Style.block) {
			indentLevel -= 1
		}
		semanticToken(location)
		const style = stack.pop()
		if (style === undefined) {
			throw new Error("unexpected end of stack")
		}
		currentRequiredStyle = style
	}

	const ds: core.ITreeBuilder<ParserAnnotationData, null, null> = {

		onData: data => {
			switch (data.type[0]) {
				case "close array": {
					closeToken(data.annotation.range.start)
					precedingToken = [PrecedingTokenType.other]
					break
				}
				case "close object": {
					closeToken(data.annotation.range.start)
					precedingToken = [PrecedingTokenType.other]
					break
				}
				case "open array": {
					semanticToken(data.annotation.range.start)
					push()
					precedingToken = [PrecedingTokenType.other]
					break
				}
				case "open object": {
					semanticToken(data.annotation.range.start)
					push()
					precedingToken = [PrecedingTokenType.other]
					break
				}
				case "string value": {
					semanticToken(data.annotation.range.start)
					precedingToken = [PrecedingTokenType.option]
					break
				}
				case "key": {
					semanticToken(data.annotation.range.start)
					precedingToken = [PrecedingTokenType.other]
					break
				}
				case "option": {
					semanticToken(data.annotation.range.start)
					precedingToken = [PrecedingTokenType.option]
					break
				}
				case "tagged union": {
					semanticToken(data.annotation.range.start)
					precedingToken = [PrecedingTokenType.pipe]
					break
				}
				default:
					assertUnreachable(data.type[0])
			}
			return p.value(false)
		},
		onEnd: () => {

			if (precedingWhitespace !== null) {
				del(precedingWhitespace.range)
			}
			return onEnd().try(() => {
				return p.success(null)
			})
		},
	}
	return ds
}