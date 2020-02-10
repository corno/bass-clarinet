
export type Allow = {
    trailing_commas?: boolean
    parens_instead_of_braces?: boolean
    angle_brackets_instead_of_brackets?: boolean
    comments?: boolean
    missing_commas?: boolean
    apostrophes_instead_of_quotation_marks?: boolean
    typed_unions?: boolean
    schema_reference?: boolean
}

export type Options = {
    spaces_per_tab?: number
    allow?: Allow
    require_schema_reference?: boolean
}
