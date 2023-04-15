import { syntaxTree } from "@codemirror/language"
import { CompletionContext } from "@codemirror/autocomplete"
import { SyntaxNode } from "@lezer/common"
import { getDocState, DocState, isContentCell } from "./interactiveCode"
import { EditorView, Tooltip, hoverTooltip } from "@codemirror/view"
import { EditorState } from "@codemirror/state"

import { RLanguage } from "../../argonaut-lezer-r/src"

// const tagOptions = [
//   "constructor", "deprecated", "link", "param", "returns", "type"
// ].map(tag => ({label: "@" + tag, type: "keyword"}))

export const rsessioncompletions = RLanguage.data.of({
    autocomplete: getSessionAutocompletions
});

const ALT_COMPLETION_PARENTS = ["DollarExpr"]
const KEYWORDS = ["if", "else", "for", "in", "while", "repeat", "function"]
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
            let nodeLen = containingNode.to - containingNode.from
            if (nodeLen == 1 && parentNode !== null && ALT_COMPLETION_PARENTS.indexOf(parentNode.name) < 0) {
                //use general var names
                let completions = getIdentifierCompletions(parentNode!, context, docState)
                if (completions !== null) return completions

            }
        }

    }
    return null
}


function getDollarExprCompletions(dollarExprNode: SyntaxNode, context: CompletionContext, docState: DocState) {
    let startPos = context.pos
    if (dollarExprNode !== null) {
        let callerValue = getCallerValue(dollarExprNode!, context, docState)
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
        validFor: /^(\w)$/
    }
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

                let wordList = varNames.concat(KEYWORDS)
                let typeList = varTypes.concat(KEYWORD_TYPES)

                return makeWordListResponse(wordList, typeList, identifierNode.from)
            }
        }
    }
    return null
}

//========================================================
// Helper Functions
//========================================================

function getCallerValue(exprNode: SyntaxNode, context: CompletionContext, docState: DocState): any | null {
    let callerNode = exprNode.firstChild
    //for now only process an identifier
    if (callerNode !== null && callerNode.name == "Identifier" ) {
        let varName = context.state.doc.sliceString(callerNode.from, callerNode.to)
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

function getVarValueForCell(varName: string, cellOffspringNode: SyntaxNode, docState: DocState, fromInput=true): any {
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
                    if (varValue !== undefined) {
                        return varValue
                    }
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
// Hover Tooltip
//========================================================

export const identifierHover = hoverTooltip((view: EditorView, pos: number, side: 1|-1) => {
    let containingNode: SyntaxNode | null = syntaxTree(view.state).resolve(pos, side)
    if (containingNode !== null) {
        let nodeName = containingNode.name
        if (nodeName == "Identifier") {
            //use general var names
            let result = getIdentifierNodeValue(containingNode, view.state)
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

function getIdentifierNodeValue(identifierNode: SyntaxNode, state: EditorState) {
    let parentNode = identifierNode.parent
    if(parentNode !== null) {
        let lookupFunc = parentToValueFuncMap[parentNode.name]
        if(lookupFunc) {
            return lookupFunc(identifierNode,state)
        } 
    }
    return null
}

type ValueLookupFunction = (identifierNode: SyntaxNode, state: EditorState) => {name: string, valueData: any} | null

function getValueExprIdentifier(identifierNode: SyntaxNode, state: EditorState) {
    let name = state.doc.sliceString(identifierNode.from,identifierNode.to)
    let docState = getDocState(state)
    let valueData: any = getVarValueForCell(name, identifierNode, docState)
    if(valueData != null) {
        return {name, valueData}
    }
    return null
}

function valueForArgValueParent(identifierNode: SyntaxNode, state: EditorState) {
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
    
    return getValueExprIdentifier(identifierNode,state)
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



