import { Range, Location } from "../location"
import { IDataSubscriber } from "../IDataSubscriber"

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
) {
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

	const ds: IDataSubscriber = {
		onBlockComment: (value, metaData) => {
			comment(metaData.outerRange.start)
			const ei = createExpectedIndentation()
			const properlyIndentedBlockComment = value.split("\n").map(line => {
				return ei + line.trim()
			}).join("\n")
			replace(metaData.innerRange, properlyIndentedBlockComment)
			precedingToken = [PrecedingTokenType.other]
		},
		onCloseArray: data => {
			closeToken(data.range.start)
			precedingToken = [PrecedingTokenType.other]
		},
		onCloseObject: data => {
			closeToken(data.range.start)
			precedingToken = [PrecedingTokenType.other]
		},
		onColon: () => {
			punctuation()
			precedingToken = [PrecedingTokenType.colon]
		},
		onComma: () => {
			punctuation()
			precedingToken = [PrecedingTokenType.other]
		},
		onLineComment: (_value, metaData) => {
			comment(metaData.outerRange.start)
			precededByLineComment = true
		},
		onNewLine: metaData => {
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
					del(metaData.range)
					break
				}
				case PrecedingTokenType.newLine: {

					del(metaData.range)
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
					range: metaData.range,
				},
				precededByLineComment: precededByLineComment,
			}]
			precededByLineComment = false
		},
		onOpenArray: data => {
			semanticToken(data.range.start)
			push()
			precedingToken = [PrecedingTokenType.other]
		},
		onOpenObject: data => {
			semanticToken(data.range.start)
			push()
			precedingToken = [PrecedingTokenType.other]
		},
		onOpenTaggedUnion: metaData => {
			semanticToken(metaData.range.start)
			precedingToken = [PrecedingTokenType.pipe]
		},
		onString: (_value, data) => {
			semanticToken(data.range.start)
			if (precedingToken[0] === PrecedingTokenType.pipe) {
				precedingToken = [PrecedingTokenType.option]
			} else {
				precedingToken = [PrecedingTokenType.other]
			}
		},
		onWhitespace: (value, metaData) => {
			precedingWhitespace = {
				range: metaData.range,
				value: value,
			}
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