// /*eslint
// 	complexity: off
// */
// import * as p from "pareto"
// import * as h from "../handlers"

// export type StackContext = {
// 	objectDepth: number
// 	arrayDepth: number
// }

// interface Annotater<ArrayContext, NonContext, ObjectContext, ValueContext> {
// 	objectBegin: (data: {
// 		data: h.ObjectData
// 		context: ValueContext
// 		stackContext: StackContext
// 	}) => ObjectContext
// 	property: (data: {
// 		data: h.PropertyData
// 		context: ObjectContext
// 		stackContext: StackContext
// 		isFirst: boolean
// 	}) => ValueContext
// 	objectEnd: (data: {
// 		context: ObjectContext
// 		stackContext: StackContext
// 		beginData: h.ObjectData
// 	}) => NonContext

// 	arrayBegin: (data: {
// 		data: h.ArrayData
// 		context: ValueContext
// 		stackContext: StackContext
// 	}) => ArrayContext
// 	element: (data: {
// 		context: ArrayContext
// 		stackContext: StackContext
// 		isFirst: boolean
// 	}) => ValueContext
// 	arrayEnd: (data: {
// 		context: ArrayContext
// 		stackContext: StackContext
// 		beginData: h.ObjectData
// 	}) => NonContext

// 	simpleValue: (data: {
// 		data: h.SimpleValueData
// 		context: ValueContext
// 		stackContext: StackContext
// 	}) => NonContext

// 	taggedUnionBegin: (data: {
// 		data: h.TaggedUnionData
// 		context: ValueContext
// 		stackContext: StackContext
// 	}) => ValueContext
// }

// export function createAnnotations<TokenAnnotation, NonTokenAnnotation, ArrayContext, NonContext, ObjectContext, ValueContext>(
// 	downstreamHandler: h.RequiredValueHandler<OutTokenAnnotation, OutNonTokenAnnotation>,
// 	annotater: Annotater<ArrayContext, NonContext, ObjectContext, ValueContext>,
// ): h.RequiredValueHandler<InTokenAnnotation, InNonTokenAnnotation> {
// 	return createRequiredValueHandler(
// 		downstreamHandler,
// 		annotater,
// 		{
// 			objectDepth: 0,
// 			arrayDepth: 0,
// 		}
// 	)
// }

// function createRequiredValueHandler<ArrayContext, NonContext, ObjectContext, ValueContext>(
// 	downstreamHandler: h.RequiredValueHandler<OutTokenAnnotation, OutNonTokenAnnotation>,
// 	annotater: Annotater<ArrayContext, NonContext, ObjectContext, ValueContext>,
// 	stackContext: StackContext
// ): h.RequiredValueHandler<InTokenAnnotation, InNonTokenAnnotation> {
// 	return {
// 		onExists: createValueHandler(downstreamHandler.onExists, annotater, stackContext),
// 		onMissing: () => downstreamHandler.onMissing(),
// 	}
// }

// function createValueHandler<ArrayContext, NonContext, ObjectContext, ValueContext>(
// 	downStreamHandler: h.ValueHandler<OutTokenAnnotation, OutNonTokenAnnotation>,
// 	annotater: Annotater<ArrayContext, NonContext, ObjectContext, ValueContext>,
// 	stackContext: StackContext
// ): h.ValueHandler<InTokenAnnotation, InNonTokenAnnotation> {
// 	return {
// 		object: data => {
// 			const out = {
// 				context: annotater.objectBegin(
// 					data,
// 					stackContext,
// 				),
// 				type: data.data.type,
// 			}
// 			const oh = downStreamHandler.object(out)
// 			let isFirst = true
// 			return {
// 				onData: propertyData => {
// 					const wasFirst = isFirst
// 					isFirst = false
// 					return oh.onData({
// 						context: annotater.property(
// 							propertyData,
// 							stackContext,
// 							wasFirst,
// 							out
// 						),
// 						key: propertyData.key,
// 					}).mapResult(rvh => p.value(createRequiredValueHandler(
// 						rvh,
// 						annotater,
// 						{
// 							objectDepth: stackContext.objectDepth + 1,
// 							arrayDepth: stackContext.arrayDepth,
// 						},
// 					)))
// 				},
// 				onEnd: endData => {
// 					return oh.onEnd({
// 						context: annotater.objectEnd(endData, stackContext, out),
// 					})
// 				},
// 			}
// 		},
// 		array: data => {
// 			const out = {
// 				context: annotater.arrayBegin(data, stackContext),
// 				type: data.type,
// 			}
// 			const ah = downStreamHandler.array(out)
// 			let isFirstElement = true
// 			return {
// 				onData: elementData => {
// 					const wasFirstElement = isFirstElement
// 					isFirstElement = false
// 					return createValueHandler(
// 						ah.onData({
// 							context: annotater.element(elementData, stackContext, wasFirstElement, out),
// 						}),
// 						annotater,
// 						{
// 							objectDepth: stackContext.objectDepth,
// 							arrayDepth: stackContext.arrayDepth + 1,
// 						},
// 					)
// 				},
// 				onEnd: endData => {
// 					return ah.onEnd({
// 						context: annotater.arrayEnd(endData, stackContext, out),
// 					})
// 				},
// 			}
// 		},
// 		simpleValue: data => downStreamHandler.simpleValue({
// 			context: annotater.simpleValue(data, stackContext),
// 			wrapper: data.wrapper,
// 			value: data.value,
// 		}),
// 		taggedUnion: data => {
// 			const out = {
// 				context: annotater.taggedUnionBegin(data, stackContext),
// 			}
// 			const tu = downStreamHandler.taggedUnion(out)
// 			return {
// 				option: optionData => {
// 					return createRequiredValueHandler(
// 						tu.option({
// 							context: annotater.option(optionData, stackContext, out),
// 							option: optionData.option,
// 						}),
// 						annotater,
// 						stackContext,
// 					)
// 				},
// 				missingOption: () => {
// 					tu.missingOption()
// 				},
// 				end: endData => {
// 					tu.end({
// 						context: annotater.taggedUntionEnd(endData, stackContext, out),
// 					})
// 				},
// 			}
// 		},
// 	}
// }