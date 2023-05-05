//===================================
// Theme
//===================================

import {EditorView} from "@codemirror/view"

export const customScrollerTheme = EditorView.baseTheme({
  "& .cm-scroller::-webkit-scrollbar": {
      "width": "20px",
  },
  "& .cm-scroller::-webkit-scrollbar-corner": {
      "background": "rgba(0,0,0,0)"
  },
  "& .cm-scroller::-webkit-scrollbar-thumb": {
      "background-color": "#808080",
      "border-radius": "6px",
      "border": "4px solid rgba(0,0,0,0)",
      "background-clip": "content-box",
      "min-width": "32px",
      "min-height": "32px"
  },
  "& .cm-scroller::-webkit-scrollbar-track": {
      "background-color": "rgba(0,0,0,0)"
  },
})

export const repdocTheme = EditorView.baseTheme({

  "&": {height: "100%"},
  ".cm-scroller": {overflow: "auto"},

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

  //=================
  // Output Display
  //=================

  "& .cm-outputdisplay-base": {
    "border": "1px solid #808080",
    "padding": "5px"
  },
    
  "&light .cm-outdisplay-code-dirty": {backgroundColor: "rgb(245, 245, 220)"},
  "&light .cm-outdisplay-inputs-dirty": {backgroundColor: "#808080"}, 
  "&light .cm-outdisplay-pending": {backgroundColor: "#808080"},
  "&light .cm-outdisplay-clean": {backgroundColor: "#F0F0F8"},

  "&dark .cm-outdisplay-code-dirty": {backgroundColor: "rgb(77, 77, 12)"},
  "&dark .cm-outdisplay-inputs-dirty": {backgroundColor: "#808080"}, 
  "&dark .cm-outdisplay-pending": {backgroundColor: "#808080"},
  "&dark .cm-outdisplay-clean": {backgroundColor: "#0F0F08"},
  //==================
  // Var Display CSS
  //==================

  //-----------
  // light
  //-----------
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
  },

//-------------------
// dark
//-------------------

  "&dark .cm-vardisplay-main": { 
    "backgroundColor": "rgb(6,42,89)",
    "marginLeft": "15px",
    "opacity": ".5",
    "paddingLeft": "5px",
    "paddingRight": "5px"
  },
  "&dark .cm-vd-fullContainer": {
    "backgroundColor": "#1E1E1E"
  },

  "&dark .cm-vd-wrapperSpan": {
    "fontFamily": "monospace",
    "color": "#FFFFFF"
  },

  "&dark .cm-vd-varTable": {
    "borderCollapse": "collapse",
    "fontFamily": "monospace",
    "margin": "5px"
  },

  "&dark .cm-vd-varName": {
    "color": "#5294E2"
  },
  "&dark .cm-vd-varType": {
    "color": "#A9A9F2"
  },
  "&dark .cm-vd-listLabel": {
    "color": "#CCCCCC",
  },
  "&dark .cm-vd-notFirst": {
    "marginLeft": "5px"
  },
  "&dark .cm-vd-listBody": {
    "marginLeft": "5px",
    "color": "#FFFFFF",
  },

  "&dark .cm-vd-titleContainer": {
    "margin": "5px",
  },
  "&dark .cm-vd-extraContainer": {
    "margin": "5px",
    "backgroundColor": "#444444"
  },
  "&dark .cm-vd-linesContainer": {
    "padding": "5px",
  },

  "&dark .cm-vd-tableNameCell": {
    "padding": "1px 3px",
    "textAlign": "center",
    "color": "#888888",
    "backgroundColor": "#444444"
  },
  "&dark .cm-vd-verticalText": {
    "writingMode": "vertical-rl",
    "textOrientation": "upright"
  },
  "&dark .cm-vd-tableIndexCell": {
    "padding": "1px 3px",
    "textAlign": "center",
    "color": "#888888",
    "fontStyle": "italic",
    "backgroundColor": "#444444"
  },
  "&dark .cm-vd-tableCornerCell": {
    "padding": "1px 3px"
  },
  "&dark .cm-vd-tableValueCell": {
    "padding": "2px 5px",
    "textAlign": "center",
    "color": "#FFFFFF",
    "backgroundColor": "#666666"
  }
})