/*eslint
	complexity: off
*/
import * as p from "pareto"
import { Range, Location } from "../location"
import { IParserEventConsumer, ParserEventType } from "../IParserEventConsumer"

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
}

type PrecedingToken =
	| [PrecedingTokenType.newLine, {
		token: TokenInfo
		precededByLineComment: boolean
	}]
	| [PrecedingTokenType.colon]
	| [PrecedingTokenType.pipe]
	| [PrecedingTokenType.option]
	| [PrecedingTokenType.nothing]
	| [PrecedingTokenType.other]


export function createFormatter(
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
	onDone: () => void,
): IParserEventConsumer {
	let precedingWhitespace: null | TokenInfo = null

	const stack: Style[] = []
	let currentRequiredStyle: Style | null = Style.root
	let precedingToken: PrecedingToken = [PrecedingTokenType.nothing]
	let precededByLineComment = false
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
			expectedIndentation += "    "
		}
		return expectedIndentation
	}

	function ensureIndentation(location: Location) {
		insertOrReplacePrecedingWhiteSpace(location, createExpectedIndentation())
	}

	function comment(
		location: Location
	) {
		switch (precedingToken[0]) {
			case PrecedingTokenType.colon: {
				ensureSpaceBefore(location)
				break
			}
			case PrecedingTokenType.other: {
				ensureSpaceBefore(location)
				break
			}
			case PrecedingTokenType.nothing: {
				break
			}
			case PrecedingTokenType.option: {
				ensureSpaceBefore(location)
				break
			}
			case PrecedingTokenType.newLine: {
				ensureIndentation(location)
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

	function punctuation(
	) {
		if (precedingToken[0] === PrecedingTokenType.newLine && !precedingToken[1].precededByLineComment) {
			del(precedingToken[1].token.range)
		}
		if (precedingWhitespace) {
			del(precedingWhitespace.range)
		}
		precedingWhitespace = null
	}

	function semanticToken(
		location: Location
	) {
		switch (precedingToken[0]) {
			case PrecedingTokenType.colon: {
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
					ensureSpaceBefore(location)
					currentRequiredStyle = Style.inline
				} else {
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
				}
				break
			}
			case PrecedingTokenType.newLine: {
				if (precedingToken[1].precededByLineComment) {
					ensureIndentation(location)
				} else {
					if (currentRequiredStyle === null) {
						ensureSpaceBefore(location)
						currentRequiredStyle = Style.inline
					} else {
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

	const ds: IParserEventConsumer = {

		onData: data => {
			switch (data.type[0]) {
				case ParserEventType.BlockComment: {
					const $ = data.type[1]
					comment(data.range.start)
					const ei = createExpectedIndentation()
					const splitted = $.comment.split("\n")
					const properlyIndentedBlockComment = splitted.map((line, index) => {
						if ($.indentation !== null) {
							if (line.startsWith($.indentation)) {
								line = line.substr($.indentation.length)
							}
						}
						if (index === splitted.length - 1) {
							//last line, always indent
							return ei + line.trimRight()
						}
						//not the last line. Only indent if it has content.
						return (ei + line).trimRight()
					}).join("\n")
					replace($.innerRange, properlyIndentedBlockComment)
					precedingToken = [PrecedingTokenType.other]
					break
				}
				case ParserEventType.CloseArray: {
					closeToken(data.range.start)
					precedingToken = [PrecedingTokenType.other]
					break
				}
				case ParserEventType.CloseObject: {
					closeToken(data.range.start)
					precedingToken = [PrecedingTokenType.other]
					break
				}
				case ParserEventType.Colon: {
					punctuation()
					precedingToken = [PrecedingTokenType.colon]
					break
				}
				case ParserEventType.Comma: {
					punctuation()
					precedingToken = [PrecedingTokenType.other]
					break
				}
				case ParserEventType.LineComment: {
					comment(data.range.start)
					precededByLineComment = true
					break
				}
				case ParserEventType.NewLine: {
					//const $ = data[1]
					if (precedingWhitespace !== null) {
						del(precedingWhitespace.range)
					}
					precedingWhitespace = null
					function x() {
						if (currentRequiredStyle === null) {
							currentRequiredStyle = Style.block
							indentLevel += 1
						}
					}
					switch (precedingToken[0]) {
						case PrecedingTokenType.colon: {
							del(data.range)
							break
						}
						case PrecedingTokenType.newLine: {

							del(data.range)
							break
						}
						case PrecedingTokenType.nothing: {
							break
						}
						case PrecedingTokenType.other: {
							x()
							break
						}
						case PrecedingTokenType.option: {
							x()
							break
						}
						case PrecedingTokenType.pipe: {
							x()
							break
						}
						default:
							assertUnreachable(precedingToken[0])
					}
					precedingToken = [PrecedingTokenType.newLine, {
						token: {
							value: "\n",
							range: data.range,
						},
						precededByLineComment: precededByLineComment,
					}]
					precededByLineComment = false
					break
				}
				case ParserEventType.OpenArray: {
					semanticToken(data.range.start)
					push()
					precedingToken = [PrecedingTokenType.other]
					break
				}
				case ParserEventType.OpenObject: {
					semanticToken(data.range.start)
					push()
					precedingToken = [PrecedingTokenType.other]
					break
				}
				case ParserEventType.SimpleValue: {
					semanticToken(data.range.start)
					if (precedingToken[0] === PrecedingTokenType.pipe) {
						precedingToken = [PrecedingTokenType.option]
					} else {
						precedingToken = [PrecedingTokenType.other]
					}
					break
				}
				case ParserEventType.TaggedUnion: {
					semanticToken(data.range.start)
					precedingToken = [PrecedingTokenType.pipe]
					break
				}
				case ParserEventType.WhiteSpace: {
					const $ = data.type[1]
					precedingWhitespace = {
						range: data.range,
						value: $.value,
					}
					break
				}
				default:
					assertUnreachable(data.type[0])
			}
			return p.result(false)
		},
		onEnd: () => {
			if (precedingWhitespace !== null) {
				del(precedingWhitespace.range)
			}
			onDone()
		},
	}
	return ds
}