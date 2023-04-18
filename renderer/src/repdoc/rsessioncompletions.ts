import { syntaxTree } from "@codemirror/language"
import { CompletionContext } from "@codemirror/autocomplete"
import { SyntaxNode } from "@lezer/common"
import { getDocState, DocState, isContentCell, isCell } from "./interactiveCode"
import { EditorView, Tooltip, hoverTooltip, showTooltip } from "@codemirror/view"
import { EditorState, StateField } from "@codemirror/state"
import { addEventListener } from "../session/sessionApi"

import { RLanguage } from "../../argonaut-lezer-r/src"

// const tagOptions = [
//   "constructor", "deprecated", "link", "param", "returns", "type"
// ].map(tag => ({label: "@" + tag, type: "keyword"}))

export const rsessioncompletions = RLanguage.data.of({
    autocomplete: getSessionAutocompletions
});
export const rsessioncompletions2 = RLanguage.data.of({
    autocomplete: getSessionAutocompletions2
});

const ALT_COMPLETION_PARENTS = ["DollarExpr"]
const KEYWORDS = ["if", "else", "for", "in", "while", "repeat", "function"]
const KEYWORD_TYPES = new Array(KEYWORDS.length).fill("keyword")

let libVarData: any[] = []
let libCompletionVarNames: string[] = []
let libCompletionVarTypes: string[] = []
//let libFunctionMap: Record<string,string> = {}  //NOT USED NOW!

let savedContext: CompletionContext | null
let savedData: any | null

function getSessionAutocompletions2(context: CompletionContext) {
    if(savedContext && context.state.doc == savedContext?.state.doc && context.pos == savedContext.pos) {
        savedContext = null
        
        if(savedData && savedData.type == "Identifier") {
if(libCompletionVarNames.length == 0) return undefined

            //return makeWordListResponse(KEYWORDS, KEYWORD_TYPES, savedData.from)
            return makeWordListResponse(libCompletionVarNames, libCompletionVarTypes, savedData.from)
        }
    }
    else {
        return undefined
    }
}

function getSessionAutocompletions(context: CompletionContext) {
    //saving text
    savedContext = context
    savedData = null

    let containingNode: SyntaxNode | null = syntaxTree(context.state).resolve(context.pos, -1)
    if (containingNode !== null) {
        //check for trigger token
        let nodeName = containingNode.name
        let parentNode = containingNode.parent
        let docState = getDocState(context.state)

        //else check for general identifier
        if (nodeName == "$") {
            if (parentNode !== null && parentNode.name == "DollarExpr") {
                //provide the $ autocomplete
                let completions = getDollarExprCompletions(parentNode!, context, docState)
                if (completions !== null) return completions

            }
        }

        // if (nodeName == "(") {
        //   if(parentNode !== null && parentNode.name == "StdCall") {
        //     //provide the function call info!
        //   }
        // }

        if (nodeName == "Identifier") {

            //===============
            //test
            savedData = {
                type: "Identifier",
                from: containingNode!.from
            }
            //===============

            let nodeLen = containingNode.to - containingNode.from
            if (nodeLen == 1 && parentNode !== null && ALT_COMPLETION_PARENTS.indexOf(parentNode.name) < 0) {
                //use general var names
                let completions = getIdentifierCompletions(containingNode!, context, docState)
                if (completions !== null) return completions

            }
        }

    }
    return undefined
}


function getDollarExprCompletions(dollarExprNode: SyntaxNode, context: CompletionContext, docState: DocState) {
    let startPos = context.pos
    if (dollarExprNode !== null) {
        let callerValue = getCallerValue(dollarExprNode!, context.state, docState)
        if (callerValue !== null) {
            let nameList = getListNames(callerValue!)
            if (nameList !== null) {
                startPos
                return makeWordListResponse(nameList!, "property", startPos)
            }
        }
    }
    return null
}

/** This makees a autocompletion word list
 * - valueList - the string values
 * - valueTypeInfo - this is either a single type or an array of types matching the value list
 * - startPos - where the identifier starts
 */
function makeWordListResponse(valueList: string[], valueTypeInfo: string | string[], startPos: number) {
    let wordOptions = valueList.map((value: string, index: number) => {
        let valueType = Array.isArray(valueTypeInfo) ? valueTypeInfo[index] : valueTypeInfo
        return { label: value, type: valueType }
    })
    return {
        from: startPos,
        options: wordOptions,
        validFor: /^[a-zA-Z][.0-9a-zA-Z]*$|^\.([\.a-zA-Z][\.0-9a-zA-Z]*)?$/ 
    }

    // this is checking if it is in a word: /^(\w)$/

    //note add detail and info:
    //detail could be the type and other into (appears in dropdown entry)
    //info could be a description (is an extension of dropdown entry)
}

//----------------------
// General Identifiers
//----------------------

function getIdentifierCompletions(identifierNode: SyntaxNode, context: CompletionContext, docState: DocState) {
    let cellNode = getParentCellNode(identifierNode)
    if (cellNode !== null) {
        //We only need to consider inputs. We don't predict outputs yet
        //if we have a LHS context completion, we might want different results?
        let prevCellNode = getPrevCellNode(cellNode)
        if(prevCellNode !== null) {
            //WE DON'T HANDLE FIRST LINE PROPERLY!
            let prevCellInfo = getCellInfo(prevCellNode, docState)
            if (prevCellInfo !== null && prevCellInfo!.isUpToDate()) {
                let varNames = Object.keys(prevCellInfo.cellEnv)
                let varTypes = new Array(varNames.length).fill("variable")

                return makeWordListResponse(varNames, varTypes, identifierNode.from)

                //let wordList = varNames.concat(KEYWORDS)
                //let typeList = varTypes.concat(KEYWORD_TYPES)
                //return makeWordListResponse(wordList, typeList, identifierNode.from)
            }
        }
    }
    return null
}

//========================================================
// Helper Functions
//========================================================

/** This function can be called to get the caller value of a expression node
 * for cases where the caller is the first node in the expression node.
 */
function getCallerValue(exprNode: SyntaxNode, state: EditorState, docState: DocState): any | null {
    let callerNode = exprNode.firstChild
    //for now only process an identifier
    if (callerNode !== null && callerNode.name == "Identifier" ) {
        let varName = state.doc.sliceString(callerNode.from, callerNode.to)
        return getVarValueForCell(varName, callerNode, docState)
    }
    return null
}

/** This function gets the parent cell for a content node (it assumes the cell is not an empty cell) */
function getParentCellNode(node: SyntaxNode) {
    let cellNode: SyntaxNode | null = node
    while (cellNode !== null && !isContentCell(cellNode.name)) {
        cellNode = cellNode.parent
    }
    return cellNode
}

function getVarValueForCell(varName: string, cellOffspringNode: SyntaxNode, docState: DocState, fromInput=true, functionOnly=false): any {
    let cellNode = getParentCellNode(cellOffspringNode)
    if(cellNode !== null) {
        let lookupNode = fromInput ? getPrevCellNode(cellNode) : cellNode
        //NOTE - I NEED TO HANDLE FIRST LINE. IT WILL TAKE A DIFFERENT LOOKUP
        if(lookupNode !== null) {
            let reqCellInfo = getCellInfo(lookupNode, docState)
            if (reqCellInfo !== null && reqCellInfo!.isUpToDate()) {
                let cellEnv = reqCellInfo!.cellEnv
                let versionedVarName = cellEnv[varName]
                if (versionedVarName !== undefined) {
                    let varTable = docState.varTable
                    let varValue = varTable.table[versionedVarName]
                    if (varValue !== undefined && (!functionOnly || varValue.type == "function")) {
                        return varValue
                    }
                }

                /////////////////////////////////////////////////////////
                //try global
                /////////////////////////////////////////////////////////
                for(let i=0; i< libVarData.length; i++) {
                    let varValue = libVarData[i].var[varName]
                    if(varValue != undefined && (!functionOnly || varValue.type == "function")) return varValue
                }
            }
        }
    }

    return null
}

function getPrevCellNode(cellNode: SyntaxNode) {
    //WILL BE NULL FOR FIRST LINE
    return cellNode.prevSibling
}


function getCellInfo(cellNode: SyntaxNode, docState: DocState) {
    if (cellNode !== null) {
        let prevCellInfo = docState.cellInfos.find(cellInfo => cellInfo.from == cellNode!.from)
        //DOH! I probably need to check if the new editor state matches the doc state 
        if (prevCellInfo !== undefined) {
            return prevCellInfo
        }
    }
    return null
}

/** This gets the names from a list-type object */
function getListNames(callerValue: any): string[] | null {
    if (callerValue.type == "list" && callerValue.names !== undefined) {
        return callerValue.names.filter((name: string) => name !== "")
    }
    else if (callerValue.type == "data.frame" && callerValue.colNames !== undefined) {
        return callerValue.colNames.filter((name: string) => name !== "")
    }
    return null
}

/** Returns the index of the child node in the parent. Returns -1 if the child is not in the parent. */
function getChildIndex(childNode: SyntaxNode) {
    let parentNode = childNode.parent
    let childFrom = childNode.from
    if(parentNode !== null) {
        let sibling = parentNode.firstChild
        let index = 0
        while(sibling != null && sibling.from != childFrom) {
            index += 1
            sibling = sibling.nextSibling
        }
        if(sibling != null) {
            return index
        }
    }
    return -1
}

//========================================================
// Cursor Tooltip
//========================================================

type TooltipInfo = {
    name: string
    line: number
    tooltip: Tooltip
} 


export function cursorTooltip() {
    return [cursorTooltipField, cursorTooltipBaseTheme]
}

const cursorTooltipBaseTheme = EditorView.baseTheme({
    ".cm-tooltip.cm-tooltip-cursor": {
        backgroundColor: "#66b",
        color: "white",
        border: "none",
        padding: "2px 7px",
        borderRadius: "4px",
        "& .cm-tooltip-arrow:before": {
            borderTopColor: "#66b"
        },
        "& .cm-tooltip-arrow:after": {
            borderTopColor: "transparent"
        }
    }
});

const cursorTooltipField = StateField.define<TooltipInfo | null>({
    create(state: EditorState) {
        return null 
    },

    update(tooltipInfo, tr) {
        if (tr.docChanged || tr.selection) {
            return getCursorTooltip(tooltipInfo,tr.state)
        }
        else {
            return tooltipInfo
        }
    },

    provide: f => showTooltip.computeN([f], state => {
        let tooltipInfo = state.field(f)
        return tooltipInfo ? [tooltipInfo.tooltip] : []
    })
})

function getCursorTooltip(tooltipInfo: TooltipInfo | null, state: EditorState): TooltipInfo | null {
    if(state.selection.main.empty) {
        let pos = state.selection.main.head
        let node: SyntaxNode | null = syntaxTree(state).resolve(pos, -1)
        while(node !== null && !isCell(node.name)) {
            if(node.name == "StdCall") {
                return getFuncSigTooltipInfo(node,tooltipInfo,state)
            }
            node = node.parent
        }
    }
    return null
}

function getFuncSigTooltipInfo(stdCallNode: SyntaxNode, tooltipInfo: TooltipInfo | null, state: EditorState) {
    let calleeNode = stdCallNode.firstChild
    //for now just do identifiers
    if(calleeNode !== null && calleeNode.name == "Identifier") {
        let name = state.doc.sliceString(calleeNode.from,calleeNode.to)
        let line = state.doc.lineAt(calleeNode.to).number
        if(tooltipInfo !== null && tooltipInfo.name == name && tooltipInfo.line == line) {
            //keep same tooltip
            return tooltipInfo
        }

        //new tooltip
        let fromInput = true
        let functionOnly = true
        let result = getIdentifierNodeValue(calleeNode, state, fromInput, functionOnly)
        if(result !== null && result.valueData.type == "function") {
            let tooltip =  {
                pos: calleeNode.to,
                above: true,
                strictSide: true,
                arrow: false,
                create: () => {
                    let dom = document.createElement("div")
                    dom.className = "cm-tooltip-cursor"
                    dom.textContent = result!.name + ": " + result!.valueData.signature
                    return { dom }
                }
            }

            return { name, line, tooltip } 
        }
    }
    return null
}

//========================================================
// Hover Tooltip
//========================================================


export const identifierHover = hoverTooltip((view: EditorView, pos: number, side: 1|-1) => {
    let containingNode: SyntaxNode | null = syntaxTree(view.state).resolve(pos, side)
    if (containingNode !== null) {
        let nodeName = containingNode.name
        if (nodeName == "Identifier") {
            //use general var names
            let fromInput = true //FIX THIS!!!
            let functionOnly = false //is this oko?
            let result = getIdentifierNodeValue(containingNode, view.state, fromInput, functionOnly)
            if(result !== null) {
                return getTooltipInfo(result.name, result.valueData, containingNode.from, containingNode.to)
            }
        }
    }
    return null
})


function getTooltipInfo(varName: string, value: any, startPos: number, endPos: number): Tooltip {
  return {
      pos: startPos,
      end: endPos,
      above: true,
      create(view: any) {
          let dom = document.createElement("div")
          dom.textContent = JSON.stringify(value,null,"  ") 
          return {dom}
      }
  }
}

function getIdentifierNodeValue(identifierNode: SyntaxNode, state: EditorState, fromInput: boolean, functionOnly: boolean) {
    let parentNode = identifierNode.parent
    if(parentNode !== null) {
        let lookupFunc = parentToValueFuncMap[parentNode.name]
        if(lookupFunc) {
            return lookupFunc(identifierNode,state,fromInput,functionOnly)
        } 
    }
    return null
}

type ValueLookupFunction = (identifierNode: SyntaxNode, state: EditorState, fromInput: boolean, functionOnly: boolean) => {name: string, valueData: any} | null

function getValueExprIdentifier(identifierNode: SyntaxNode, state: EditorState, fromInput = true, functionOnly = false) {
    let name = state.doc.sliceString(identifierNode.from,identifierNode.to)
    let docState = getDocState(state)
    let valueData: any = getVarValueForCell(name, identifierNode, docState, fromInput, functionOnly)
    if(valueData != null) {
        return {name, valueData}
    }
    return null
}

function valueForArgValueParent(identifierNode: SyntaxNode, state: EditorState, fromInput = true, functionOnly = false) {
    let childIndex = getChildIndex(identifierNode)
    if(childIndex == 0) {
        if(identifierNode.nextSibling !== null) {
            //this means our identifier is the name for the variable, which is not a variable
            return null
        }
    }
    else if(childIndex == -1) {
        return null
    } 
    
    return getValueExprIdentifier(identifierNode,state,fromInput,functionOnly)
}

const parentToValueFuncMap: Record<string,ValueLookupFunction> = {
    "UnaryExpr": getValueExprIdentifier,
    "BinaryExpr": getValueExprIdentifier,
    "ParenExpr": getValueExprIdentifier,
    "Block": getValueExprIdentifier,
    "IfExpr": getValueExprIdentifier,
    "RepeatExpr": getValueExprIdentifier,
    "WhileExpr": getValueExprIdentifier,
    "Cell": getValueExprIdentifier,
    "EndCell": getValueExprIdentifier,

    "StdCall": getValueExprIdentifier, //this will only be the function name
    "ArgValue":  valueForArgValueParent, //this is other elements in a StdCall
}

// these ones require other logic:
// DollarExpr
// NamespaceExpr
// SlotExpr
// BrckExpr
// DblBrckExpr
// ForExpr
// StdCall
// FuncDef



//========================================
// library data test
//========================================
function processEnvData(eventName: string, data: any) {

    libVarData = data

    libCompletionVarNames = []
    libCompletionVarTypes = []
    // libFunctionMap = {}
    data.forEach( (packageData:any) => {
        var keys = Object.keys(packageData.var)
        let pkgVarNames = keys.filter( (name: string) => !name.startsWith("."))
        let pkgVarTypes = pkgVarNames.map( (name: string) => packageData.var[name].type == "function" ? "function" : "variable" )
        libCompletionVarNames = libCompletionVarNames.concat(pkgVarNames)
        libCompletionVarTypes = libCompletionVarTypes.concat(pkgVarTypes)

        //get function list for cursor tooltip
        // let libFunctionNames = pkgVarNames.filter( (name: string, index: number) => pkgVarTypes[index] == "function")
        // libFunctionNames.forEach( (functionName: string) => {
        //     let signature = packageData.var[functionName].signature
        //     if(!libFunctionMap[functionName]) libFunctionMap[functionName] = signature
        // })
    })
}

addEventListener("envData", processEnvData)
