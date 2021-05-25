/*eslint
	complexity: off
*/
import * as p from "pareto"

function assertUnreachable<RT>(_x: never): RT {
	throw new Error("unreachable")
}

enum OutputTokenTypeOption {
	ListClose,
	ListOpen,
	DictionaryClose,
	DictionaryOpen,
	SimpleValue,
	TaggedUnion,
}

type OutputTokenType =
	| [OutputTokenTypeOption.ListClose]
	| [OutputTokenTypeOption.ListOpen, {
		type:
		| ["array"]
		| ["shorthand type"]
	}]
	| [OutputTokenTypeOption.DictionaryClose]
	| [OutputTokenTypeOption.DictionaryOpen, {
		type:
		| ["object"]
		| ["verbose type"]
	}]
	| [OutputTokenTypeOption.SimpleValue, {
		value: string
		wrapper:
		| ["`"]
		| ["'"]
		| ["\""]
	}]
	| [OutputTokenTypeOption.TaggedUnion, {
		option: string
	}]

type OutputToken<AD> = {
	additionalData: AD
	type: OutputTokenType
}


enum OutputStateTypeOption {
	InDictionary,
	InList,
}

type OutputStateType =
	| [OutputStateTypeOption.InDictionary, {
		expecting:
		| ["key"]
		| ["value"]
		type:
		| ["verbose type"]
		| ["object"]
	}]
	| [OutputStateTypeOption.InList, {
		type:
		| ["shorthand type"]
		| ["array"]

	}]

type OutputState = {
	type: OutputStateType
}

type AnnotatedOutputTokenType =
	| [OutputTokenTypeOption.ListClose, {
		type:
		| ["array"]
		| ["shorthand type"]
	}]
	| [OutputTokenTypeOption.ListOpen, {
		type:
		| ["array"]
		| ["shorthand type"]
	}]
	| [OutputTokenTypeOption.DictionaryClose, {
		type:
		| ["object"]
		| ["verbose type"]

	}]
	| [OutputTokenTypeOption.DictionaryOpen, {
		type:
		| ["object"]
		| ["verbose type"]
	}]
	| [OutputTokenTypeOption.SimpleValue, {
		value: string
		wrapper:
		| ["`"]
		| ["'"]
		| ["\""]
	}]
	| [OutputTokenTypeOption.TaggedUnion, {
		option: string
	}]

type WhitespaceBefore =
	| ["newline", {
		indentation: number
	}]
	| ["single space"]

type AnnotatedOutputToken<AD> = {
	additionalData: AD
	whitespaceBefore: WhitespaceBefore
	type: AnnotatedOutputTokenType
}

export function createWhitespaceGenerator<AD>(
	downStream: p.IUnsafeStreamConsumer<AnnotatedOutputToken<AD>, null, null, null>
): p.IUnsafeStreamConsumer<OutputToken<AD>, null, null, null> {
	const stack: OutputState[] = []
	let currentState: OutputState | null = null
	let indentation = 0
	function push(newState: OutputState, increment: boolean) {
		if (currentState !== null) {
			stack.push(currentState)
		}
		currentState = newState
		if (increment) {
			indentation += 1
		}
	}
	function pop(expectedCurrentStateType: OutputStateTypeOption, decrement: boolean) {
		if (currentState === null) {
			console.error("unexpected end of collection")
		} else {
			if (currentState.type[0] !== expectedCurrentStateType) {
				console.error("unexpected collection type")
			}
			const previous = stack.pop()
			if (previous !== undefined) {
				currentState = previous
			}
			if (decrement) {
				indentation -= 1
			}
		}
	}
	return {
		onData: outputToken => {
			switch (outputToken.type[0]) {
				case OutputTokenTypeOption.ListClose: {
					pop(OutputStateTypeOption.InList, false)
					return downStream.onData({
						additionalData: outputToken.additionalData,
						whitespaceBefore: ["single space"],
						type: [OutputTokenTypeOption.ListClose, {
							type: ["array"],
						}],
					})
				}
				case OutputTokenTypeOption.ListOpen: {
					const $ = outputToken.type[1]
					push({
						type: [OutputStateTypeOption.InList, {
							type: $.type,
						}],
					}, false)
					return downStream.onData({
						additionalData: outputToken.additionalData,
						whitespaceBefore: ["single space"],
						type: [OutputTokenTypeOption.ListOpen, {
							type: $.type,
						}],
					})
				}
				case OutputTokenTypeOption.DictionaryClose: {
					if (currentState === null || currentState.type[0] !== OutputStateTypeOption.InDictionary) {
						console.error("unexpected dictionary close")
					} else {
						if (currentState.type[1].expecting[0] !== "key") {
							console.error("missing dictionary value")
						}
					}
					pop(OutputStateTypeOption.InDictionary, true)
					return downStream.onData({
						additionalData: outputToken.additionalData,
						whitespaceBefore: ["single space"],
						type: [OutputTokenTypeOption.DictionaryClose, {
							type: currentState === null
								? ["object"]
								: currentState.type[0] !== OutputStateTypeOption.InDictionary
									? ["object"]
									: currentState.type[1].type,
						}],
					})
				}
				case OutputTokenTypeOption.DictionaryOpen: {
					const $ = outputToken.type[1]

					push({
						type: [OutputStateTypeOption.InDictionary, {
							expecting: ["key"],
							type: $.type,
						}],
					}, true)
					return downStream.onData({
						additionalData: outputToken.additionalData,
						whitespaceBefore: ["single space"],
						type: [OutputTokenTypeOption.DictionaryOpen, {
							type: $.type,
						}],
					})
				}
				case OutputTokenTypeOption.SimpleValue: {
					const $ = outputToken.type[1]
					if (currentState === null || currentState.type[0] !== OutputStateTypeOption.InDictionary || currentState.type[1].expecting[0] === "value") {
						return downStream.onData({
							additionalData: outputToken.additionalData,
							whitespaceBefore: ((): WhitespaceBefore => {
								return ["single space"]
							})(),
							type: [OutputTokenTypeOption.SimpleValue, {
								value: $.value,
								wrapper: $.wrapper[0] === "'" ? ["\""] : $.wrapper,
							}],
						})
					}
					return downStream.onData({
						additionalData: outputToken.additionalData,
						whitespaceBefore: ((): WhitespaceBefore => {
							return ["newline", {
								indentation: indentation,
							}]
						})(),
						type: [OutputTokenTypeOption.SimpleValue, {
							value: $.value,
							wrapper: ["'"],
						}],
					})
				}
				case OutputTokenTypeOption.TaggedUnion: {
					const $ = outputToken.type[1]
					return downStream.onData({
						additionalData: outputToken.additionalData,
						whitespaceBefore: ["single space"],
						type: [OutputTokenTypeOption.TaggedUnion, {
							option: $.option,
						}],
					})
				}
				default:
					return assertUnreachable(outputToken.type[0])
			}
		},
		onEnd: (aborted, data) => {
			return downStream.onEnd(aborted, data)
		},
	}
}
