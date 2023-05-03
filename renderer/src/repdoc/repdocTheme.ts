//===================================
// Theme
//===================================

import {EditorView} from "@codemirror/view"

export const repdocTheme = EditorView.baseTheme({
  //======================
  // Repdoc Display CSS
  //======================
  "&light .cm-rd-errText": {color: "red", fontWeight: "bold"},
  "&light .cm-rd-wrnText": {color: "orange", fontWeight: "bold"},
  "&light .cm-rd-msgText": {color: "blue"},
  "&dark .cm-rd-errText": {color: "red", fontWeight: "bold"},
  "&dark .cm-rd-wrnText": {color: "orange", fontWeight: "bold"},
  "&dark .cm-rd-msgText": {color: "lightblue"},

  "&light .cm-rd-codeDirtyShade": {backgroundColor: "rgba(145,200,255,0.5)"},
  "&light .cm-rd-valuePendingShade": {backgroundColor: "rgba(180,180,180,0.5)"},
  "&dark .cm-rd-codeDirtyShade": {backgroundColor: "rgba(52,26,0,0.5)"},
  "&dark .cm-rd-valuePendingShade": {backgroundColor: "rgba(31,31,31,0.5)"},
    
  //==================
  // Var Display CSS
  //==================
  "&light .cm-vardisplay-main": { 
    "backgroundColor": "rgb(249,213,166)", 
    "marginLeft": "15px",
    "opacity": ".5",
    "paddingLeft": "5px",
    "paddingRight": "5px"
  },
  "&light .cm-vd-fullContainer": {
    "backgroundColor": "#f5f5f5"
  },

  "&light .cm-vd-wrapperSpan": {
    "fontFamily": "monospace",
    "color": "#000000"
  },

  "&light .cm-vd-varTable": {
    "borderCollapse": "collapse",
    "fontFamily": "monospace",
    "margin": "5px"
  },

  "&light .cm-vd-varName": {
    "color": "#0000d7"
  },
  "&light .cm-vd-varType": {
    "color": "#383cf0"
  },
  "&light .cm-vd-listLabel": {
    "color": "#444444",
  },
  "&light .cm-vd-notFirst": {
    "marginLeft": "5px"
  },
  "&light .cm-vd-listBody": {
    "marginLeft": "5px",
    "color": "#222222",
  },

  "&light .cm-vd-titleContainer": {
    "margin": "5px",
  },
  "&light .cm-vd-extraContainer": {
    "margin": "5px",
    "backgroundColor": "#e6e6e6"
  },
  "&light .cm-vd-linesContainer": {
    "padding": "5px",
  },

  "&light .cm-vd-tableNameCell": {
    "padding": "1px 3px",
    "textAlign": "center",
    "color": "#888888",
    "backgroundColor": "#dadada"
  },
  "&light .cm-vd-verticalText": {
    "writingMode": "vertical-rl",
    "textOrientation": "upright"
  },
  "&light .cm-vd-tableIndexCell": {
    "padding": "1px 3px",
    "textAlign": "center",
    "color": "#888888",
    "fontStyle": "italic",
    "backgroundColor": "#dadada"
  },
  "&light .cm-vd-tableCornerCell": {
    "padding": "1px 3px"
  },
  "&light .cm-vd-tableValueCell": {
    "padding": "2px 5px",
    "textAlign": "center",
    "color": "#000000",
    "backgroundColor": "#e6e6e6"
  }
})