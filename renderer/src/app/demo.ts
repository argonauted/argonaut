import {startSessionListener,addEventListener,initDoc} from "../session/sessionApi"

import {EditorView} from "@codemirror/view"

import {basicSetup} from "codemirror"
import {markdown} from "../lang_markdown_sp/index"

import {repdoc,sessionOutputToView} from "../repdoc/repdoc"

//=========================
// script
//=========================
let view: any = null

//start the session
addEventListener("initComplete",onInitComplete)
addEventListener("sessionOutput", onSessionOutput)
startSessionListener()

//=========================
// functions
//=========================

function onInitComplete(eventName: string, data: any) {
  console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$ INIT COMPLETE")
  console.log("Init complete!")
  setTimeout(startEditor,0)
}

function onSessionOutput(eventName: string, data: any) {
  sessionOutputToView(view,data)
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
