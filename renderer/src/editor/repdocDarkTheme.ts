import {EditorView} from "@codemirror/view"
import {Extension} from "@codemirror/state"
import {HighlightStyle, syntaxHighlighting} from "@codemirror/language"
import {tags as t} from "@lezer/highlight"

// Using https://github.com/one-dark/vscode-one-dark-theme/ as reference for the colors

const chalky = "#e5c07b",
  coral = "#e06c75",
  cyan = "#56b6c2",
  ivory = "#abb2bf",
  stone = "#7d8799", // Brightened compared to original to increase contrast
  malibu = "#61afef",
  sage = "#98c379",
  whiskey = "#d19a66",
  violet = "#c678dd",
  darkBackground = "#21252b",
  highlightBackground = "#2c313a",
  
  tooltipBackground = "#303030",
  selection = "#3E4451",
  cursor = "#528bff",

  invalid = "#ff0000",
  background = "#1e1e1e",

  text = "#d4d4d4",
  lesserText = "#949494",

  comment = "#228822",
  keyword = "#6688dd",
  bracket =  "#d4d4d4",
  operator =  "#d4d4d4",
  variable =  "#e8e8e8",
  float = "#ead993",
  integer = "#ead993",
  string = "#da946a",
  boolean = "#aa88ee",
  literal = "#ee88aa"
  

/// The colors used in the theme, as CSS color strings.
export const color = {
  chalky,
  coral,
  cyan,
  invalid,
  ivory,
  stone,
  malibu,
  sage,
  whiskey,
  violet,
  darkBackground,
  highlightBackground,
  background,
  tooltipBackground,
  selection,
  cursor,

  text, 

  comment,
  keyword,
  bracket,
  operator,
  variable,
  float,
  integer,
  string,
  boolean,
  literal

}

/// The editor theme styles for One Dark.
export const repdocDarkTheme = EditorView.theme({
  "&": {
    color: ivory,
    backgroundColor: background
  },

  ".cm-content": {
    caretColor: cursor
  },

  ".cm-cursor, .cm-dropCursor": {borderLeftColor: cursor},
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {backgroundColor: selection},

  ".cm-panels": {backgroundColor: darkBackground, color: ivory},
  ".cm-panels.cm-panels-top": {borderBottom: "2px solid black"},
  ".cm-panels.cm-panels-bottom": {borderTop: "2px solid black"},

  ".cm-searchMatch": {
    backgroundColor: "#72a1ff59",
    outline: "1px solid #457dff"
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "#6199ff2f"
  },

  ".cm-activeLine": {outline: "1px dotted #565e81"},
  ".cm-selectionMatch": {backgroundColor: "#aafe661a"},

  "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
    backgroundColor: "#bad0f847"
  },

  ".cm-gutters": {
    backgroundColor: background,
    color: stone,
    border: "none"
  },

  ".cm-activeLineGutter": {
    backgroundColor: highlightBackground
  },

  ".cm-foldPlaceholder": {
    backgroundColor: "transparent",
    border: "none",
    color: "#ddd"
  },

  ".cm-tooltip": {
    border: "1px solid #606060",
    borderRadius: "3px",
    backgroundColor: tooltipBackground
  },
  ".cm-tooltip .cm-tooltip-arrow:before": {
    borderTopColor: "transparent",
    borderBottomColor: "transparent"
  },
  ".cm-tooltip .cm-tooltip-arrow:after": {
    borderTopColor: tooltipBackground,
    borderBottomColor: tooltipBackground
  },
  ".cm-tooltip-autocomplete": {
    "& > ul > li[aria-selected]": {
      backgroundColor: highlightBackground,
      color: ivory
    }
  },

  //repdoc specific
  ".cm-rd-codeDirtyShade": {backgroundColor: "#0d0e2f"},
  ".cm-rd-valuePendingShade": {backgroundColor: "#3a3417"}

}, {dark: true})

/// The highlighting style for code in the One Dark theme.
export const repDarkHighlightStyle = HighlightStyle.define([
  {tag: t.comment, color: comment},
  {tag: t.keyword, color: keyword},
  {tag: t.bracket, color: bracket},
  {tag: t.operator, color: operator},
  {tag: t.variableName, color: variable},
  {tag: t.string, color: string},
  {tag: t.float, color: float},
  {tag: t.integer, color: integer},
  {tag: t.bool, color: boolean},
  {tag: t.literal, color: literal},

  {tag: t.invalid, color: invalid},
    
  {tag: t.strong, fontWeight: "bold"},
  {tag: t.emphasis, fontStyle: "italic"},
  {tag: t.strikethrough, textDecoration: "line-through"},
  {tag: t.link, color: stone, textDecoration: "underline"},
  {tag: t.heading1, fontWeight: "bold", fontSize: "24px", color: text},
  {tag: t.heading2, fontWeight: "bold", fontSize: "20px", color: text},
  {tag: t.heading3, fontWeight: "bold", fontSize: "16px", color: text},
  {tag: t.heading4, fontWeight: "bold", fontSize: "14px", color: text},
  {tag: t.heading5, fontWeight: "bold", fontSize: "14px", color: lesserText},
  {tag: t.heading6, fontSize: "14px", color: lesserText},
  {tag: t.heading, fontWeight: "bold", fontSize: "16px", color: text},
  
])

//original definitions
// {tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName],
//   color: coral},
//  {tag: [t.function(t.variableName), t.labelName],
//   color: malibu},
//  {tag: [t.color, t.constant(t.name), t.standard(t.name)],
//   color: whiskey},
//  {tag: [t.definition(t.name), t.separator],
//   color: ivory},
//  {tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace],
//   color: chalky},
//  {tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)],
//   color: cyan},
//  {tag: [t.meta, t.comment],
//   color: stone},
//  {tag: t.strong,
//   fontWeight: "bold"},
//  {tag: t.emphasis,
//   fontStyle: "italic"},
//  {tag: t.strikethrough,
//   textDecoration: "line-through"},
//  {tag: t.link,
//   color: stone,
//   textDecoration: "underline"},
//  {tag: t.heading,
//   fontWeight: "bold",
//   color: coral},
//  {tag: [t.atom, t.bool, t.special(t.variableName)],
//   color: whiskey },
//  {tag: [t.processingInstruction, t.string, t.inserted],
//   color: sage},
//  {tag: t.invalid,
//   color: invalid},

/// Extension to enable the One Dark theme (both the editor theme and
/// the highlight style).
export const repdocDark: Extension = [repdocDarkTheme, syntaxHighlighting(repDarkHighlightStyle)]