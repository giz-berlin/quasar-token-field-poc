<template>
    <q-field ref="fieldRef" clearable filled :dense="dense" stack-label class="token-select" :disable="disable"
        :error="!!error" :error-message="error" @focus="onFocus">
        <template #control="{ id }">
            <div class="token-select-container">
                <div v-if="tokenGroups.length > 0" class="token-group-container q-mr-sm">
                    <div v-for="(tokenGroup, groupIdx) in tokenGroups" :key="groupIdx" class="fit-content token-group">
                        <template v-for="(token, tokenIdx) in tokenGroup.tokens" :key="tokenIdx">
                            <q-chip square size="md" :ripple="false"
                                :removable="tokenGroup.tokens.length > 1 && tokenGroup.completed && tokenIdx === tokenGroup.tokens.length - 1"
                                :icon="token.icon" :label="token.label" @remove="deleteTokenGroupAtIndex(groupIdx)" />
                        </template>
                    </div>
                </div>
                <div class="field-input">
                    <input :id="id" ref="inputRef" autocomplete="off" class="q-field__input fit" :value="currentInputValue"
                        :readonly="disable" @input="e => { onType(e) }" @keydown="onKeyDown">
                    <q-menu ref="menuRef" square no-parent-event :offset="[0, 20]" no-focus no-refocus anchor="bottom left"
                        self="top left">
                        <q-item v-for="(option, idx) in filteredOptions" :key="idx" :active="idx === menuOptionIndex"
                            clickable manual-focus :focused="false" :tabindex="-1" role="option"
                            :onmousemove="() => { $q.platform.is.desktop && (menuOptionIndex = idx) }"
                            @click="(evt) => { selectOption(option, idx); inputRef?.focus() }">
                            <q-item-section v-if="option.icon" avatar><q-icon :name="option.icon" /></q-item-section>
                            <q-item-section>{{ option.label }}</q-item-section>
                        </q-item>
                        <q-item v-if="filteredOptions.length === 0" :focused="false" :tabindex="-1" role="option">
                            <q-item-section><q-icon name="sym_o_error" /></q-item-section>
                            <!-- TODO: this should be a slot. -->
                            <q-item-section>No&nbsp;options</q-item-section>
                        </q-item>
                    </q-menu>
                </div>
            </div>
        </template>
    </q-field>
</template>

<script lang="ts" setup generic="Option extends TokenSelectBaseOption = TokenSelectBaseOption">
import { QField, QMenu } from 'quasar'
import { ref, computed } from 'vue'

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

export type TokenSelectToken<O extends TokenSelectBaseOption = TokenSelectBaseOption> =
    // Need to use the `Distributive...` types here as O could be a union.
    DistributiveOmit<O, 'icon' | 'willCompleteTokenGroup' | 'willCreateTokenGroup'>
    & Partial<DistributivePick<O, 'icon'>>

export type TokenSelectTokenGroup<O extends TokenSelectBaseOption = TokenSelectBaseOption> = {
    tokens: TokenSelectToken<O>[],
    completed: boolean,
}

const props = defineProps<{
    dense?: boolean,
    disable?: boolean,
    options: Option[],
    tokenGroups: TokenSelectTokenGroup<Option>[],
    error?: string,
}>()
const emit = defineEmits({
    'select-option': (option: Option, idx: number) => true,
    'delete-token-group': (tokenGroup: TokenSelectTokenGroup<Option>, idx: number) => true,
    blur: (event: Event) => true,
})

const currentInputValue = ref('')
const menuOptionIndex = ref(-1)

// A reference to the quasar menu component.
const menuRef = ref<InstanceType<typeof QMenu> | null>(null)

// A reference to the input.
const inputRef = ref<InstanceType<typeof HTMLInputElement> | null>(null)
const fieldRef = ref<InstanceType<typeof QField> | null>(null)

/**
 * A helper that filters the options based on the current input.
 */
const filteredOptions = computed(() => {
    const trimmedInput = currentInputValue.value.trim().toLocaleLowerCase()
    if (trimmedInput.length < 1) {
        return props.options
    }
    return props.options.filter((option) => option.label.toLocaleLowerCase().includes(trimmedInput))
})

const showMenu = () => {
    const menu = menuRef.value
    if (!menu) {
        return
    }
    menu.updatePosition()
    menu.show()
}

const onFocus = () => {
    if (props.disable) {
        return
    }
    showMenu()
}

const onType = (event: Event) => {
    const target = <HTMLInputElement | null>event.target
    if (!target) {
        return
    }
    setTimeout(showMenu)
    currentInputValue.value = target.value
}

const onKeyDown = (event: KeyboardEvent) => {
    showMenu()
    switch (event.key) {
        case 'ArrowDown':
            offsetMenuOptionIndex(1)
            event.preventDefault()
            break
        case 'ArrowUp':
            offsetMenuOptionIndex(-1)
            event.preventDefault()
            break
        case 'Enter':
            if (menuOptionIndex.value < 0 || menuOptionIndex.value >= filteredOptions.value.length) {
                return
            }
            selectOption(filteredOptions.value[menuOptionIndex.value], menuOptionIndex.value)
            event.preventDefault()
            break
        case 'Backspace':
            if (!currentInputValue.value) {
                // Only delete group when input is empty
                deleteTokenGroupAtIndex(props.tokenGroups.length - 1)
                event.preventDefault()
                setTimeout(showMenu)
            }
            break
        default:
            break
    }
}

const offsetMenuOptionIndex = (offset = 1) => {
    // Clamp to the number of available options.
    menuOptionIndex.value = Math.min(Math.max(menuOptionIndex.value + offset, 0), filteredOptions.value.length - 1)
}

const selectOption = (option: Option, idx: number) => {
    const input = inputRef.value
    if (!input) {
        return
    }

    currentInputValue.value = ''
    menuOptionIndex.value = -1
    input.scrollIntoView({ behavior: 'smooth', inline: 'end', block: 'nearest' })
    setTimeout(showMenu)
    emit('select-option', option, idx)
    return false
}

const deleteTokenGroupAtIndex = (idx: number) => {
    if (idx < 0 || idx >= props.tokenGroups.length) {
        return
    }
    emit('delete-token-group', props.tokenGroups[idx], idx)
}
</script>

<style lang="scss" scoped>
.token-select {
    position: relative;
}

.token-select-container {
    position: absolute;
    width: 100%;
    display: flex;
    white-space: nowrap;
    overflow-x: scroll;
    flex-wrap: nowrap;
}

.token-group-container {
    display: inline;
    white-space: nowrap;
}

.token-group {
    display: inline-block;

    & :not(:last-child) {
        margin-right: 0.5px;
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
    }

    & :not(:first-child) {
        margin-left: 0.5px;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
    }
}

.field-input {
    display: inline-block;
    min-width: 200px;
    flex-grow: 1;
}
</style>
