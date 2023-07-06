<template>
    <FilterTokenSelect :filter-presets="filterPresets" :disable="disable" :dense="dense" v-model="filter" />
</template>

<script lang="ts" setup>

import { onMounted, ref } from 'vue'
import { Filter, Todo } from './models'
import { useQuasar } from 'quasar'
import FilterTokenSelect from './FilterTokenSelect.vue'

const SAMPLE_TODO_DATA: Todo[] = [
    {
        title: "Convince Humans I'm the Ruler of the House",
        author: 'Fluffy',
        content: 'Employ strategic meowing and intense staring tactics.',
        dueDate: new Date('2023-07-10T09:00:00Z')
    },
    {
        title: 'Learn to Open the Treat Jar',
        author: 'Whiskers',
        content: 'Develop paw dexterity and master the art of twisting lids.',
        dueDate: new Date('2023-08-01T13:30:00Z')
    },
    {
        title: 'Master the Art of Napping in the Sun',
        author: 'Mittens',
        content: 'Find the perfect sunbeam and practice snoozing techniques.',
        dueDate: new Date('2023-07-15T18:00:00Z')
    },
    {
        title: 'Create Chaos at 3 AM',
        author: 'Luna',
        content: 'Run through the house, knock down objects, and wake up the humans.',
        dueDate: new Date('2023-09-30T10:15:00Z')
    },
    {
        title: 'Become a Master Climber',
        author: 'Simba',
        content: 'Conquer the tallest bookshelves and claim them as my kingdom.',
        dueDate: new Date('2023-07-20T16:45:00Z')
    }
]

const $q = useQuasar()

defineProps<{
    dense?: boolean,
    disable?: boolean,
}>()

defineEmits({
    'update:modelValue'() {
        return true
    }
})

// Data
const todos = ref<null | Todo[]>(null);

const filterPresets = [
    {
        type: 'title' as const,
        icon: 'sym_o_title' as const,
        label: 'Title' as const,
        operations: {
            is: true,
            isNot: true,
            oneOf: false,
        },
        getValues() {
            const todosList = todos.value
            if (!todosList) {
                return []
            }
            return todosList.map((todo) => ({
                label: todo.title,
                value: todo.title,
            }))
        },
    },
    {
        type: 'author' as const,
        icon: 'sym_o_person' as const,
        label: 'Author' as const,
        operations: {
            is: true,
            isNot: false,
            oneOf: false,
        },
        getValues() {
            const todosList = todos.value
            if (!todosList) {
                return []
            }
            return todosList.map((todo) => ({
                label: todo.author,
                value: 42,
            }))
        },
    }
]

onMounted(() => {
    // Load the data for showing options.
    const loadData = async () => {
        try {
            // Dummy for loading todo data e.g. via API.
            todos.value = [...SAMPLE_TODO_DATA]
        } catch (ex) {
            const message = ex instanceof Error ? ex.message : 'Unknown error'
            $q.notify({
                message: `Failed loading data: ${message}`,
                multiLine: true,

            })
        }
    }
    loadData()
})

const filter = ref<Filter<typeof filterPresets[number]> | null>(null)
</script>
