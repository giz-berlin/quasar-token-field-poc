<template>
    <TokenSelect :dense="dense" :disable="disable" :error="error" :options="availableOptions" :token-groups="tokenGroups"
        @select-option="selectOption" @delete-token-group="deleteTokenGroup" />
</template>

<script lang="ts" setup generic="PT extends string, Predicates extends FilterPredicate<PT>">
import TokenSelect from './TokenSelect.vue';
import { LeafFilter, LeafFilterOptions, TokenSelectBaseOption, areFiltersEqual, type TokenSelectTokenGroup, OPERATOR_IS_TYPE, OPERATOR_IS_NOT_TYPE, OPERATOR_ONE_OF_TYPE } from './models'
import { Ref, computed, ref, shallowRef, watchEffect, watchSyncEffect } from 'vue'
import { type FilterPredicate, type Filter } from './models'

type PredicateOption = {
    type: PT,
    label: string,
    icon?: string,
    willCreateTokenGroup: true,
    willCompleteTokenGroup: false,
}

type FilterValueOption<T = unknown> = {
    type: 'filter-value',
    label: string,
    icon?: string,
    willCreateTokenGroup: false,
    willCompleteTokenGroup: true,
    value: T,
}

const OPENING_BRACKET = {
    type: 'opening-bracket' as const,
    label: '(' as const,
    icon: 'sym_o_data_object' as const,
    willCreateTokenGroup: true,
    willCompleteTokenGroup: true,
}

const CLOSING_BRACKET = {
    type: 'closing-bracket' as const,
    label: ')' as const,
    icon: 'sym_o_data_object' as const,
    willCreateTokenGroup: true,
    willCompleteTokenGroup: true,
}

type BracketOption = |
    typeof OPENING_BRACKET |
    typeof CLOSING_BRACKET;


const AND_OPERATION = {
    type: 'and-operation' as const,
    label: 'AND' as const,
    icon: 'sym_o_join_inner' as const,
    willCreateTokenGroup: true,
    willCompleteTokenGroup: true,
}

const OR_OPERATION = {
    type: 'or-operation' as const,
    label: 'OR' as const,
    icon: 'sym_o_join_full' as const,
    willCreateTokenGroup: true,
    willCompleteTokenGroup: true,
}

type OperationOption = |
    typeof AND_OPERATION |
    typeof OR_OPERATION;

const IS_OPERATOR = {
    type: OPERATOR_IS_TYPE,
    icon: 'sym_o_equal' as const,
    label: 'is' as const,
    willCompleteTokenGroup: false,
    willCreateTokenGroup: false,
}

const IS_NOT_OPERATOR = {
    type: OPERATOR_IS_NOT_TYPE,
    icon: 'sym_o_exclamation' as const,
    label: 'is not' as const,
    willCompleteTokenGroup: false,
    willCreateTokenGroup: false,
}

const ONE_OF_OPERATOR = {
    type: OPERATOR_ONE_OF_TYPE,
    icon: 'sym_o_filter_none' as const,
    label: 'is one of' as const,
    willCompleteTokenGroup: false,
    willCreateTokenGroup: false,
}

type OperatorOption = |
    typeof IS_OPERATOR |
    typeof ONE_OF_OPERATOR |
    typeof IS_NOT_OPERATOR;

const props = defineProps<{
    dense?: boolean,
    disable?: boolean,
    filterPresets: Predicates[],
    modelValue: Filter<Predicates, PT> | null,
}>()

const emits = defineEmits({
    'update:modelValue': (filter: Filter<Predicates, PT>) => true,
})

type Option = |
    PredicateOption |
    FilterValueOption |
    OperatorOption |
    BracketOption |
    OperationOption;

// Of course, vue breaks doing something like a ref to an array.
// https://github.com/vuejs/core/issues/2136
const tokenGroups = ref<TokenSelectTokenGroup<Option>[]>([]) as Ref<TokenSelectTokenGroup<Option>[]>;

// States for selection.
type State = |
    'no-token-group' |
    'filter-selected' |
    'operator-selected' |
    'after-token-group' |
    'after-opening-bracket' |
    'after-operation';

const state = computed<State>(() => {
    let retVal: State = 'no-token-group'
    if (tokenGroups.value.length > 0) {
        const group = tokenGroups.value[tokenGroups.value.length - 1]
        if (group.completed === false) {
            if (group.tokens.length === 1) {
                retVal = 'filter-selected'
            } else if (group.tokens.length === 2) {
                retVal = 'operator-selected'
            } else {
                retVal = 'after-token-group'
            }
        } else if (group.tokens.length > 0) {
            const type = group.tokens[0].type
            if (type === OPENING_BRACKET.type) {
                retVal = 'after-opening-bracket'
            } else if (type === CLOSING_BRACKET.type) {
                retVal = 'after-token-group'
            } else if (type === AND_OPERATION.type || type === OR_OPERATION.type) {
                retVal = 'after-operation'
            } else {
                retVal = 'after-token-group'
            }
        }
    }
    return retVal
})

const error = ref<string | undefined>(undefined)

const currentFilter = computed<Predicates | null>(() => {
    if (tokenGroups.value.length > 0) {
        const group = tokenGroups.value[tokenGroups.value.length - 1]
        for (const filterPresent of props.filterPresets) {
            if (filterPresent.type === group.tokens[0].type) {
                return filterPresent
            }
        }
    }
    return null
})

const isOperator = (token: { type: string }): token is OperatorOption =>
    token.type === IS_OPERATOR.type || token.type === IS_NOT_OPERATOR.type || token.type === ONE_OF_OPERATOR.type

const currentOperator = computed<OperatorOption['type'] | null>(() => {
    if (tokenGroups.value.length > 0) {
        const group = tokenGroups.value[tokenGroups.value.length - 1]
        if (group.tokens.length === 2) {
            const token = group.tokens[1]
            if (isOperator(token)) {
                return token.type
            }
        }
    }
    return null
})

const hasOperationsOnBracketLevel = computed(() => {
    const retValue: number[] = [0]
    let bracketLevel = 0
    for (const tokenGroup of tokenGroups.value) {
        if (bracketLevel < 0) {
            throw new Error('Cannot have more closing brackets than opening ones.')
        }
        if (tokenGroup.completed && tokenGroup.tokens.length === 1) {
            switch (tokenGroup.tokens[0].type) {
                case OPENING_BRACKET.type:
                    bracketLevel += 1
                    retValue[bracketLevel] = 0
                    break
                case CLOSING_BRACKET.type:
                    bracketLevel -= 1
                    break
                case AND_OPERATION.type:
                case OR_OPERATION.type:
                    retValue[bracketLevel] += 1
                    break
                default:
                    break
            }
        }
    }
    return retValue[bracketLevel] > 0
})

const bracketLevel = computed(() => {
    let bracketLevel = 0
    for (const tokenGroup of tokenGroups.value) {
        if (bracketLevel < 0) {
            throw new Error('Cannot have more closing brackets than opening ones.')
        }
        if (tokenGroup.completed && tokenGroup.tokens.length === 1) {
            switch (tokenGroup.tokens[0].type) {
                case OPENING_BRACKET.type:
                    bracketLevel += 1
                    break
                case CLOSING_BRACKET.type:
                    bracketLevel -= 1
                    break
                default:
                    break
            }
        }
    }
    return bracketLevel
})

const availableOptions = computed((): Option[] => {
    const retValue = [] as Option[]

    if (state.value === 'filter-selected') {
        const filter = currentFilter.value
        if (!filter) {
            throw new Error('There should be a filter.')
        }
        const operators: OperatorOption[] = []
        if (filter.operations.is) {
            operators.push({ ...IS_OPERATOR })
        }
        if (filter.operations.isNot) {
            operators.push({ ...IS_NOT_OPERATOR })
        }
        if (filter.operations.oneOf) {
            operators.push({ ...ONE_OF_OPERATOR })
        }
        return operators
    } else if (state.value === 'operator-selected') {
        const filter = currentFilter.value
        const operator = currentOperator.value
        if (!filter || !operator) {
            throw new Error('There should be a filter with an operator.')
        }
        return filter.getValues(operator).map((val): FilterValueOption => ({ ...val, willCompleteTokenGroup: true, willCreateTokenGroup: false, type: 'filter-value' as const }))
    }

    // Add the filters.
    const filterOptions: PredicateOption[] = props.filterPresets.map((preset): PredicateOption => ({
        type: preset.type,
        label: preset.label,
        icon: preset.icon,
        willCreateTokenGroup: true,
        willCompleteTokenGroup: false,
    }))

    // Add brackets.
    if ((state.value === 'no-token-group' || state.value === 'after-operation' || state.value === 'after-opening-bracket')) {
        retValue.push({ ...OPENING_BRACKET })
    }
    if (state.value === 'after-token-group' && bracketLevel.value > 0) {
        retValue.push({ ...CLOSING_BRACKET })
    }
    // Check for operations.
    if (state.value === 'after-token-group' && !hasOperationsOnBracketLevel.value) {
        retValue.push({ ...AND_OPERATION }, { ...OR_OPERATION })
    }
    if (state.value === 'after-opening-bracket' || state.value === 'no-token-group' || state.value === 'after-operation') {
        retValue.push(...filterOptions)
    }
    return retValue
})

const selectOption = (option: Option) => {
    if (option.willCreateTokenGroup) {
        tokenGroups.value.push({
            completed: option.willCompleteTokenGroup,
            tokens: [option],
        })
    } else {
        if (tokenGroups.value.length < 1) {
            throw new Error('Cannot complete a token group without one existing.')
        }
        const tokenGroup = tokenGroups.value[tokenGroups.value.length - 1]
        if (option.willCompleteTokenGroup && tokenGroup.completed) {
            throw new Error('Cannot complete a token group that is already completed.')
        }
        tokenGroup.tokens.push(option)
        if (option.willCompleteTokenGroup) {
            tokenGroup.completed = true
        }
    }
}

const deleteTokenGroup = (group: TokenSelectTokenGroup<TokenSelectBaseOption | BracketOption | OperationOption>, idx: number) => {
    // This operation is a little bit more complicated and needs removing brackets and operations.
    // E.g. an empty bracket pair wouldn't make sense, as well as a binary operation with the left side missing.

    // Inclusive remove start index.
    let from = idx
    // Inclusive remove end index.
    let to = idx

    if (group.tokens.length !== 1) {
        // This is definitely not a bracket nor an operation.
        // Do the remove dance.
        while (true) {
            // Otherwise have a look at the right side.
            const rightTokenGroup = tokenGroups.value[to + 1]
            if (rightTokenGroup && rightTokenGroup.completed && rightTokenGroup.tokens.length === 1 && rightTokenGroup.tokens[0].type === CLOSING_BRACKET.type) {
                const leftTokenGroup = tokenGroups.value[from - 1]
                if (leftTokenGroup && leftTokenGroup.completed && leftTokenGroup.tokens.length === 1 && leftTokenGroup.tokens[0].type === OPENING_BRACKET.type) {
                    to += 1
                    from -= 1
                    continue
                }
                if (leftTokenGroup && leftTokenGroup.completed && leftTokenGroup.tokens.length === 1 &&
                    (leftTokenGroup.tokens[0].type === AND_OPERATION.type || leftTokenGroup.tokens[0].type === OR_OPERATION.type)) {
                    // Between bracket and operation
                    from -= 1
                }
            }
            if (rightTokenGroup && rightTokenGroup.completed && rightTokenGroup.tokens.length === 1 && (
                rightTokenGroup.tokens[0].type === AND_OPERATION.type || rightTokenGroup.tokens[0].type === OR_OPERATION.type
            )) {
                to += 1
                continue
            }
            // We now reached a situation where we can't remove any surrounding brackets or right-side operations anymore.
            break
        }
    }
    tokenGroups.value = [...tokenGroups.value.slice(0, from), ...tokenGroups.value.slice(to + 1)]
}

const parseExpression = (groups: TokenSelectTokenGroup<Option>[], start = 0): [Filter<Predicates, PT> | null, number] => {
    if (groups.length === 0) {
        return [null, 0]
    }
    let closingBracketPosition: number | null = null
    let currentIdx = start
    let filter: Filter<Predicates, PT> | null = null
    while (currentIdx < groups.length) {
        const group = groups[currentIdx]
        if (!group.completed) {
            throw new Error(`Found incomplete group at position ${currentIdx}.`)
        }
        if (group.tokens.length === 1) {
            const tokenType = group.tokens[0].type
            switch (tokenType) {
                case OPENING_BRACKET.type:
                    const [bracketedFilter, end] = parseExpression(groups, currentIdx + 1)
                    if (!bracketedFilter) {
                        throw new Error('Could not parse subfilter.')
                    }
                    if (!filter) {
                        filter = bracketedFilter
                    } else if (filter.type === 'and' || filter.type === 'or') {
                        filter.children.push(bracketedFilter)
                    }
                    currentIdx = end
                    break
                case CLOSING_BRACKET.type:
                    closingBracketPosition = currentIdx
                    break
                case AND_OPERATION.type:
                    if (!filter) {
                        throw new Error('Cannot have an empty left side of an and operation')
                    }
                    filter = {
                        type: 'and',
                        children: [filter]
                    }
                    break
                case OR_OPERATION.type:
                    if (!filter) {
                        throw new Error('Cannot have an empty left side of an and operation')
                    }
                    filter = {
                        type: 'or',
                        children: [filter]
                    }
                    break
                default:
                    break
            }
            // This expression is done.
            if (closingBracketPosition !== null) {
                break
            }
        } else if (group.tokens.length === 3) {
            const predicate = group.tokens[0] as PredicateOption
            const operator = group.tokens[1] as OperatorOption
            const filterValue = group.tokens[2] as FilterValueOption
            const leaf: LeafFilter<Predicates, PT> = {
                type: 'leaf' as const,
                options: {
                    type: predicate.type,
                    operator: operator.type,
                    value: filterValue.value,
                } as LeafFilterOptions<Predicates>,
            }
            if (!filter) {
                filter = leaf
            } else if (filter.type === 'and' || filter.type === 'or') {
                filter.children.push(leaf)
            }
        }
        currentIdx += 1
    }
    return [filter, currentIdx]
}

const enteredFilter = shallowRef<Filter<Predicates, PT> | null>(null)
watchSyncEffect(() => {
    error.value = undefined
    try {
        const [parsedFilter, end] = parseExpression(tokenGroups.value)
        if (end !== tokenGroups.value.length || !parsedFilter) {
            throw new Error('Could not parse filter.')
        }
        enteredFilter.value = parsedFilter
        emits('update:modelValue', parsedFilter)
    } catch (ex) {
        if (ex instanceof Error) {
            error.value = ex.message
        } else {
            error.value = 'Unknown error occurred while parsing the filter.'
        }
    }
})

const filterToTokenGroups = (filter: Filter<Predicates, PT> | null) => {
    if (filter === null) {
        return []
    }
    const retVal: TokenSelectTokenGroup<Option>[] = []
    if (filter.type === 'and' || filter.type === 'or') {
        retVal.push({ completed: true, tokens: [{ ...OPENING_BRACKET }] })
        if (filter.children.length > 2) {
            throw new Error('Non-binary operations not allowed.')
        }
        // Concatenate the children.
        filter.children.forEach((child, idx) => {
            retVal.push(...filterToTokenGroups(child))
            if (idx < filter.children.length - 1) {
                if (filter.type === 'and') {
                    retVal.push({ completed: true, tokens: [{ ...AND_OPERATION }] })
                } else if (filter.type === 'or') {
                    retVal.push({ completed: true, tokens: [{ ...OR_OPERATION }] })
                } else {
                    throw new Error('Unknown operator type.')
                }
            }
        })
        retVal.push({ completed: true, tokens: [{ ...CLOSING_BRACKET }] })
    } else {
        // This is a leaf.
        // We cerate the three tokens of the group.
        const predicate = props.filterPresets.find((preset) => preset.type === filter.options.type)
        if (!predicate) {
            throw new Error('Unknown predicate found.')
        }
        const group: TokenSelectTokenGroup<Option> = {
            completed: true,
            tokens: []
        }
        group.tokens.push({
            type: predicate.type,
            icon: predicate.icon,
            label: predicate.label,
        })

        switch (filter.options.operator) {
            case 'is':
                group.tokens.push({ ...IS_OPERATOR })
                break
            case 'isNot':
                group.tokens.push({ ...IS_NOT_OPERATOR })
                break
            case 'oneOf':
                group.tokens.push({ ...ONE_OF_OPERATOR })
                break
            default:
                throw new Error('Unknown operator found.')
        }

        group.tokens.push({
            type: 'filter-value',
            label: 'unknown',
            value: filter.options.value,
        })
        retVal.push(group)
    }
    return retVal
}

watchEffect(() => {
    if (
        (!!props.modelValue && enteredFilter.value === null) ||
        (props.modelValue === null && !!enteredFilter.value) ||
        props.modelValue && enteredFilter.value && !areFiltersEqual(props.modelValue, enteredFilter.value)
    ) {
        tokenGroups.value = filterToTokenGroups(props.modelValue)
    }
})
</script>
