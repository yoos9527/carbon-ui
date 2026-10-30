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
  placeholder as placeholderExt,
  rectangularSelection
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab
} from "@codemirror/commands";
import {
  HighlightStyle,
  StreamLanguage,
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { groovy } from "@codemirror/legacy-modes/mode/groovy";

defineOptions({ name: "CodeEditor" });

const props = withDefaults(
  defineProps<{
    modelValue: string;
    readonly?: boolean;
    height?: string;
    placeholder?: string;
  }>(),
  { readonly: false, height: "320px", placeholder: "" }
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const host = ref<HTMLElement>();
const readonlyCompartment = new Compartment();
let view: EditorView | undefined;

/** 唯一配色来源：暗色。各模块 SPEC 的代码块约定与此保持一致 */
const PALETTE = {
  bg: "#0f141c",
  gutterBg: "#0c1118",
  gutterFg: "#4c5769",
  border: "#242c3a",
  text: "#e6ebf5",
  caret: "#6aa9ff",
  selection: "#26405f",
  activeLine: "#161d28",
  comment: "#6b7789",
  keyword: "#c99bff",
  string: "#7fd6a5",
  number: "#e0a33a",
  func: "#6fb4ff",
  type: "#4fd1c5",
  prop: "#a8b6cc",
  invalid: "#ff7b72"
} as const;

/**
 * 代码编辑器固定暗色（不跟随站点亮/暗主题）：代码块在亮色页面里也是一块深色面板，
 * 与 `--ink/--surface` 的语义一致，两套主题下都读得清。
 */
const darkTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      fontSize: "13px",
      color: PALETTE.text,
      backgroundColor: PALETTE.bg,
      border: `1px solid ${PALETTE.border}`,
      borderRadius: "4px"
    },
    "&.cm-focused": { outline: "none", borderColor: "#409eff" },
    ".cm-scroller": {
      fontFamily:
        'Consolas, Monaco, "Courier New", "Microsoft YaHei", monospace',
      lineHeight: "1.6"
    },
    ".cm-content": { padding: "8px 0", caretColor: PALETTE.caret },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: PALETTE.caret },
    "&.cm-focused > .cm-scroller > .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      { backgroundColor: PALETTE.selection },
    ".cm-panels": {
      backgroundColor: PALETTE.gutterBg,
      color: PALETTE.text
    },
    ".cm-gutters": {
      color: PALETTE.gutterFg,
      backgroundColor: PALETTE.gutterBg,
      border: "none"
    },
    ".cm-activeLine": { backgroundColor: PALETTE.activeLine },
    ".cm-activeLineGutter": {
      color: PALETTE.text,
      backgroundColor: PALETTE.activeLine
    },
    ".cm-foldPlaceholder": {
      color: PALETTE.text,
      backgroundColor: "transparent",
      border: `1px solid ${PALETTE.border}`
    },
    ".cm-placeholder": { color: PALETTE.comment }
  },
  { dark: true }
);

/** Groovy 词法高亮的暗色映射（`defaultHighlightStyle` 是亮色专用，这里全部重定义） */
const darkHighlight = HighlightStyle.define([
  { tag: t.comment, color: PALETTE.comment, fontStyle: "italic" },
  { tag: t.lineComment, color: PALETTE.comment, fontStyle: "italic" },
  { tag: t.blockComment, color: PALETTE.comment, fontStyle: "italic" },
  { tag: t.keyword, color: PALETTE.keyword },
  { tag: t.controlKeyword, color: PALETTE.keyword },
  { tag: t.definitionKeyword, color: PALETTE.keyword },
  { tag: t.operatorKeyword, color: PALETTE.keyword },
  { tag: t.self, color: PALETTE.keyword },
  { tag: t.string, color: PALETTE.string },
  { tag: t.special(t.string), color: PALETTE.string },
  { tag: t.number, color: PALETTE.number },
  { tag: t.bool, color: PALETTE.number },
  { tag: t.null, color: PALETTE.number },
  { tag: t.function(t.variableName), color: PALETTE.func },
  { tag: t.function(t.propertyName), color: PALETTE.func },
  { tag: t.typeName, color: PALETTE.type },
  { tag: t.className, color: PALETTE.type },
  { tag: t.definition(t.variableName), color: PALETTE.prop },
  { tag: t.propertyName, color: PALETTE.prop },
  { tag: t.operator, color: PALETTE.prop },
  { tag: t.punctuation, color: PALETTE.prop },
  { tag: t.bracket, color: PALETTE.prop },
  { tag: t.variableName, color: PALETTE.text },
  { tag: t.invalid, color: PALETTE.invalid }
]);

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
      syntaxHighlighting(darkHighlight, { fallback: true }),
      placeholderExt(props.placeholder),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        indentWithTab
      ]),
      readonlyCompartment.of(readonlyExtension(readonly)),
      darkTheme,
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
    view?.dispatch({
      effects: readonlyCompartment.reconfigure(readonlyExtension(readonly))
    });
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
