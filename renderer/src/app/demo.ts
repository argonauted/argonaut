import {runTest} from "./testFile"

import {EditorView, basicSetup} from "codemirror"
import {markdown} from "../lang_markdown_sp/index"

import {repdoc} from "../repdoc/repdoc"



;(window as any).view = new EditorView({
  doc: 'console.log("Hello world")',
  extensions: [
    basicSetup,
    repdoc(),
    markdown(/*{defaultCodeLanguage: javascript()}*/)
  ],
  parent: document.querySelector("#editorMD")!
})



setTimeout(runTest,5000)