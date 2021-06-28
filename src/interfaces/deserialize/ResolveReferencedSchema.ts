

import * as p from "pareto"


export type RetrievalError =
	| ["not found", {
		//
	}]
	| ["other", {
		"description": string
	}]

export type ResolveReferencedSchema = (id: string) => p.IUnsafeValue<p.IStream<string, null>, RetrievalError>