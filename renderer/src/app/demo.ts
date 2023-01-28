import {startListener,addListener,initDoc} from "../session/sessionApi"

import {EditorView} from "@codemirror/view"

import {basicSetup} from "codemirror"
import {markdown} from "../lang_markdown_sp/index"

import {repdoc,passEvent} from "../repdoc/repdoc"

//=========================
// script
//=========================
let view: any = null

//start the session
addListener("initComplete",onInitComplete)
addListener("console", onConsole)
addListener("plotReceived",onPlotReceived)
addListener("docStatus",onSessionMessage)
addListener("evalStart",onSessionMessage)
startListener()

//=========================
// functions
//=========================

function onInitComplete(eventName: string, data: any) {
  console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$ INIT COMPLETE")
  console.log("Init complete!")
  setTimeout(startEditor,0)
}

function onConsole(eventName: string, data: any) {
  console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$ CONSOLE")
  console.log(JSON.stringify(data,null,4))

  passEvent(view,eventName,data)
}

function onPlotReceived(eventName: string, data: any) {
  console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$ PLOT:")
  console.log(JSON.stringify(data,null,4))
}

function onSessionMessage(eventName: string, data: any) {
  console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$ SESSION MESSAGE")
  console.log(JSON.stringify(data,null,4))
}

function startEditor() {
  initDoc("ds1")
  buildUi()
}

function buildUi() {
  view = new EditorView({
    doc: 'set.seed(234)',
    extensions: [
      basicSetup,
      repdoc(),
      markdown(/*{defaultCodeLanguage: javascript()}*/)
    ],
    parent: document.querySelector("#editorMD")!
  })

  //;(window as any).view = view
}
