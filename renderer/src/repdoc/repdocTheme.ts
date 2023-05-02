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

  //"&light .cm-vardisplay-main": {color: "rgb(60,60,60)", backgroundColor: "rgb(253,234,210)", marginLeft: "15px"},
  //"&light .cm-vardisplay-label": {paddingLeft: "5px"},
  //"&light .cm-vardisplay-value": {fontStyle: "italic"},
  //"&light .cm-vardisplay-added": {fontStyle: "italic", paddingRight: "5px" },
    
  //==================
  // Var Display CSS
  //==================
  "&light .cm-vd-shortWrapper": {

  },
  
  "&light .cm-vardisplay-main": {
    "color": "rgb(60,60,60)", 
    "backgroundColor": "rgb(253,234,210)", 
    "marginLeft": "15px"
  },

  "&light .cm-vd-listLabel": {
    "fontSize": "14px",
    "marginBottom": "5px",
    "color": "#555555",
    "fontFamily": "monospace"
  },
  "&light .cm-vd-notFirst": {
    "marginLeft": "5px"
  },
  "&light .cm-vd-listBody": {
    "fontSize": "14px",
    "marginBottom": "5px",
    "color": "#000000",
    "fontFamily": "monospace",
    "marginLeft": "5px"
  },

  "&light .cm-vd-varTable": {
    "borderCollapse": "collapse",
    "fontFamily": "monospace",
    "fontSize": "14px",
    "marginTop": "5px"
  },

  "&light .cm-vd-varName": {
    "fontSize": "14px",
    "fontWeight": "bold",
    "marginBottom": "5px",
    "fontFamily": "monospace"
  },
  "&light .cm-vd-varType": {
    "fontFamily": "monospace",
    "fontSize": "14px",
    "marginBottom": "5px",
    "marginLeft": "5px"
  },
  "&light .cm-vd-tableNameCell": {
    "padding": "1px",
    "textAlign": "center",
    "color": "#888888",
    "backgroundColor": "#f2f2f2"
  },
  "&light .cm-vd-verticalText": {
    "writingMode": "vertical-rl",
    "textOrientation": "upright"
  },
  "&light .cm-vd-tableIndexCell": {
    "padding": "1px",
    "textAlign": "center",
    "color": "#888888",
    "fontStyle": "italic",
    "backgroundColor": "#f2f2f2"
  },
  "&light .cm-vd-tableCornerCell": {
    "padding": "3px"
  },
  "&light .cm-vd-tableValueCell": {
    "padding": "5px",
    "textAlign": "center",
    "color": "#000000",
    "backgroundColor": "#f7f7f7"
  }
})