<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Compartment, EditorState } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab
} from "@codemirror/commands";
import {
  StreamLanguage,
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting
} from "@codemirror/language";
import { groovy } from "@codemirror/legacy-modes/mode/groovy";

defineOptions({ name: "CodeEditor" });

const props = withDefaults(
  defineProps<{
    modelValue: string;
    readonly?: boolean;
    height?: string;
  }>(),
  { readonly: false, height: "320px" }
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const host = ref<HTMLElement>();
const readonlyCompartment = new Compartment();
let view: EditorView | undefined;

const baseTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    border: "1px solid #dcdfe6",
    borderRadius: "4px",
    backgroundColor: "#fbfbfc"
  },
  "&.cm-focused": { outline: "none", borderColor: "#409eff" },
  ".cm-scroller": {
    fontFamily:
      'Consolas, Monaco, "Courier New", "Microsoft YaHei", monospace',
    lineHeight: "1.6"
  },
  ".cm-content": { padding: "8px 0" },
  ".cm-gutters": {
    backgroundColor: "#f5f7fa",
    color: "#a8abb2",
    border: "none"
  },
  ".cm-activeLine": { backgroundColor: "#eef3fb" },
  ".cm-activeLineGutter": { backgroundColor: "#eef3fb" }
});

function readonlyExtension(readonly: boolean) {
  return [EditorView.editable.of(!readonly), EditorState.readOnly.of(readonly)];
}

function createState(doc: string, readonly: boolean) {
  return EditorState.create({
    doc,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      bracketMatching(),
      rectangularSelection(),
      highlightActiveLine(),
      StreamLanguage.define(groovy),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap, indentWithTab]),
      readonlyCompartment.of(readonlyExtension(readonly)),
      baseTheme,
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          emit("update:modelValue", update.state.doc.toString());
        }
      })
    ]
  });
}

onMounted(() => {
  if (!host.value) return;
  view = new EditorView({
    state: createState(props.modelValue ?? "", props.readonly),
    parent: host.value
  });
});

onBeforeUnmount(() => {
  view?.destroy();
  view = undefined;
});

/** 外部值变化时同步进编辑器（内部输入不再回灌，避免光标跳动） */
watch(
  () => props.modelValue,
  value => {
    if (!view) return;
    const current = view.state.doc.toString();
    if ((value ?? "") !== current) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value ?? "" }
      });
    }
  }
);

watch(
  () => props.readonly,
  readonly => {
    view?.dispatch({ effects: readonlyCompartment.reconfigure(readonlyExtension(readonly)) });
  }
);
</script>

<template>
  <div ref="host" class="code-editor" :style="{ height }" />
</template>

<style scoped lang="scss">
.code-editor {
  width: 100%;
  overflow: hidden;
}
</style>
