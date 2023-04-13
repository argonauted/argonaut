import { syntaxTree } from "@codemirror/language"
import { CompletionContext } from "@codemirror/autocomplete"
import { SyntaxNode } from "@lezer/common"
import { getDocState, DocState, isContentCell } from "./interactiveCode"

import { RLanguage } from "../../argonaut-lezer-r/src"

// const tagOptions = [
//   "constructor", "deprecated", "link", "param", "returns", "type"
// ].map(tag => ({label: "@" + tag, type: "keyword"}))

export const rsessioncompletions = RLanguage.data.of({
  autocomplete: getSessionAutocompletions
});

const ALT_COMPLETION_PARENTS = ["DollarExpr"]
const KEYWORDS = ["if","else","for","in","while","repeat","function"]
const KEYWORD_TYPES = new Array(KEYWORDS.length).fill("keyword")

function getSessionAutocompletions(context: CompletionContext) {
  let containingNode: SyntaxNode | null = syntaxTree(context.state).resolve(context.pos, -1)
  if (containingNode !== null) {
    //check for trigger token
    let nodeName = containingNode.name
    let parentNode = containingNode.parent
    let docState = getDocState(context.state)

    //else check for general identifier
    if (nodeName == "$") {
      if(parentNode !== null && parentNode.name == "DollarExpr") {
        //provide the $ autocomplete
        let completions = getDollarExprCompletions(parentNode!,context,docState)
        if(completions !== null) return completions

      }
    }

    // if (nodeName == "(") {
    //   if(parentNode !== null && parentNode.name == "StdCall") {
    //     //provide the function call info!
    //   }
    // }
    
    if (nodeName == "Identifier") {
      let nodeLen = containingNode.to - containingNode.from
      if(nodeLen == 1 && parentNode !== null && ALT_COMPLETION_PARENTS.indexOf(parentNode.name) < 0) {
        //use general var names
        let completions = getIdentifierCompletions(parentNode!,context,docState)
        if(completions !== null) return completions

      }
    }

  }
  return null
}


function getDollarExprCompletions(dollarExprNode: SyntaxNode, context: CompletionContext, docState: DocState) {
  //get the caller value
  //read the name from the caller value
  //make a list of options for autocomplete


  let startPos = context.pos
  if(dollarExprNode !== null) {
    let callerValue = getCallerValue(dollarExprNode!, context, docState)
    if(callerValue !== null) {
      let nameList = getListNames(callerValue!)
      if(nameList !== null) {
        startPos
        return makeWordListResponse(nameList!,"property",startPos)
      }
    }
  }
  return null
}

function getCallerValue(exprNode: SyntaxNode, context: CompletionContext, docState: DocState): any | null {
  let callerNode = exprNode.firstChild
  let cellNode = exprNode.parent
  //for now only process an identifier
  if(callerNode !== null && callerNode.name == "Identifier" && cellNode !== null) {

    let varName = context.state.doc.sliceString(callerNode.from,callerNode.to)
    let prevCellInfo = getPrevCellInfo(cellNode,context, docState)
    if(prevCellInfo !== null && prevCellInfo!.isUpToDate()) {
      let cellEnv = prevCellInfo!.cellEnv
      let versionedVarName = cellEnv[varName]
      if(versionedVarName !== undefined) {
        let varTable = docState.varTable
        let varValue = varTable.table[versionedVarName]
        if(varValue !== undefined) {
          return varValue
        }
      }
    }
  }
  return null
}

function getPrevCellInfo(cellNode: SyntaxNode, context: CompletionContext, docState: DocState) {
  let prevCellNode = cellNode.prevSibling
  if (prevCellNode !== null) {
    let prevCellInfo = docState.cellInfos.find(cellInfo => cellInfo.from == prevCellNode!.from)
    //DOH! I probably need to check if the new editor state matches the doc state 
    if (prevCellInfo !== undefined) {
      return prevCellInfo
    }
  }
  return null
}

/** This gets the names from a list-type object */
function getListNames(callerValue: any): string[] | null {
  if(callerValue.type == "list" && callerValue.names !== undefined) {
    return callerValue.names.filter( (name: string) => name !== "" )
  }
  else if(callerValue.type == "data.frame" && callerValue.colNames !== undefined) {
    return callerValue.colNames.filter( (name: string) => name !== "" )
  }
  return null
}

/** This makees a autocompletion word list
 * - valueList - the string values
 * - valueTypeInfo - this is either a single type or an array of types matching the value list
 * - startPos - where the identifier starts
 */
function makeWordListResponse(valueList: string[], valueTypeInfo: string | string[], startPos: number) {
  let wordOptions = valueList.map( (value: string, index: number) => {
    let valueType = Array.isArray(valueTypeInfo) ? valueTypeInfo[index] : valueTypeInfo
    return {label: value, type: valueType}
  })
  return {
    from: startPos,
    options: wordOptions,
    validFor: /^(\w)$/
  }
}


//----------------------
// General Identifiers
//----------------------

function getIdentifierCompletions(identifierNode: SyntaxNode, context: CompletionContext, docState:DocState) {
  let cellNode: SyntaxNode | null = identifierNode
  while(cellNode !== null && !isContentCell(cellNode.name)) {
    cellNode = cellNode.parent
  }
  if(cellNode !== null) {
    let prevCellInfo = getPrevCellInfo(cellNode,context,docState)
    if(prevCellInfo !== null && prevCellInfo!.isUpToDate()) {
      let varNames = Object.keys(prevCellInfo.cellEnv)
      let varTypes = new Array(varNames.length).fill("variable")

      let wordList = varNames.concat(KEYWORDS)
      let typeList = varTypes.concat(KEYWORD_TYPES)

      return makeWordListResponse(wordList,typeList,identifierNode.from)
    }
  }
  return null
}
