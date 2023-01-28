import {startListener,addListener,initDoc} from "../session/sessionApi"

import {EditorView, basicSetup} from "codemirror"
import {markdown} from "../lang_markdown_sp/index"

import {repdoc} from "../repdoc/repdoc"


//start the session
addListener("initComplete",onInitComplete)
startListener()

function onInitComplete(eventName: string, data: any) {
  console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$ INIT COMPLETE")
  console.log("Init complete!")
  setTimeout(startEditor,0)
}

function startEditor() {
  initDoc("ds1")
  buildUi()
}

function buildUi() {
  ;(window as any).view = new EditorView({
    doc: 'set.seed(234)',
    extensions: [
      basicSetup,
      repdoc(),
      markdown(/*{defaultCodeLanguage: javascript()}*/)
    ],
    parent: document.querySelector("#editorMD")!
  })
}
