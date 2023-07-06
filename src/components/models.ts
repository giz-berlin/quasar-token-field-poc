export type Todo = {
  /**
   * The ToDos author.
   */
  author: string,
  /**
   * A short title for the ToDo.
   */
  title: string,
  /**
   * Additional info.
   */
  content: string,
  /**
   * When the ToDo should be done.
   */
  dueDate: Date,
}

export type TokenSelectBaseOption = {
  type: string,
  icon?: string,
  label: string,
  willCreateTokenGroup: boolean,
  willCompleteTokenGroup: boolean,
}

export type DistributiveOmit<T, K extends keyof T> = T extends unknown
  ? Omit<T, K>
  : never;

export type DistributivePick<T, K extends keyof T> = T extends unknown
  ? Pick<T, K>
  : never;

export type TokenSelectToken<O extends TokenSelectBaseOption> =
  // Need to use the `Distributive...` types here as O could be a union.
  DistributiveOmit<O, 'icon' | 'willCompleteTokenGroup' | 'willCreateTokenGroup'>
  & Partial<DistributivePick<O, 'icon'>>

export type TokenSelectTokenGroup<O extends TokenSelectBaseOption> = {
  tokens: TokenSelectToken<O>[],
  completed: boolean,
}

export type AllowedOperations = {
  is: boolean,
  isNot: boolean,
  oneOf: boolean,
}

export type FilterPredicate<T extends string = string, V = unknown> = {
  type: T,
  label: string,
  icon: string,
  operations: AllowedOperations,
  getValues: (operation: keyof AllowedOperations) => (Pick<TokenSelectBaseOption, 'icon' | 'label'> & { value: V })[]
}

export type AndFilter<P extends FilterPredicate<T>, T extends string = string,> = {
  type: 'and',
  children: Filter<P, T>[],
}
export type OrFilter<P extends FilterPredicate<T>, T extends string = string> = {
  type: 'or',
  children: Filter<P, T>[],
}

export const OPERATOR_IS_TYPE = 'is' as const;
export const OPERATOR_IS_NOT_TYPE = 'isNot' as const;
export const OPERATOR_ONE_OF_TYPE = 'oneOf' as const;

export type Operator = typeof OPERATOR_IS_TYPE | typeof OPERATOR_IS_NOT_TYPE | typeof OPERATOR_ONE_OF_TYPE;

export type LeafFilterOptions<P> = P extends FilterPredicate<infer T, infer V> ? { type: T, operator: Operator, value: V, } : never
export type LeafFilter<P extends FilterPredicate<T>, T extends string = string> = {
  type: 'leaf',
  options: LeafFilterOptions<P>
}

export type Filter<P extends FilterPredicate<T>, T extends string = string> = |
  AndFilter<P, T> |
  OrFilter<P, T> |
  LeafFilter<P, T>;

export const areFiltersEqual = <P extends FilterPredicate<T>, T extends string>(lhs: Filter<P, T>, rhs: Filter<P, T>) => {
  if (lhs.type === 'leaf' && rhs.type === 'leaf' && lhs.options.type === rhs.options.type && lhs.options.value === rhs.options.value) {
    return true
  } else if ((lhs.type === 'and' && rhs.type === 'and') || (lhs.type === 'or' && rhs.type === 'or')) {
    if (lhs.children.length !== rhs.children.length) {
      return true
    }
    for (const [a, b] of lhs.children.map((leftChild, idx) => [leftChild, rhs.children[idx]])) {
      if (!areFiltersEqual) {
        return false
      }
    }
    return true
  }
  return false
}