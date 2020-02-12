/* eslint
    camelcase:"off",
*/

export type Allow = {
    angle_brackets_instead_of_brackets?: boolean
    apostrophes_instead_of_quotation_marks?: boolean
    comments?: boolean
    compact?: boolean
    missing_commas?: boolean
    parens_instead_of_braces?: boolean
    schema?: boolean
    trailing_commas?: boolean
    tagged_unions?: boolean
}

export type Require = {
    schema?: boolean
}

export type Options = {
    allow?: Allow
    spaces_per_tab?: number
    require?: Require
}
