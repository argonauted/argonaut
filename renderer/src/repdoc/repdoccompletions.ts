import { syntaxTree } from "@codemirror/language"
import { CompletionContext } from "@codemirror/autocomplete"
import { SyntaxNode } from "@lezer/common"
import { getDocState, DocState } from "./interactiveCode"
import { StateField } from "@codemirror/state"
import { getCellInfo, getPrevCellNode, getParentCellNode, getChildIndex, getCallerValue } from "./nodeValueUtils"
import { libCompletionVarNames, libCompletionVarTypes } from "./sessionPackageData"

import { RLanguage } from "../../argonaut-lezer-r/src"

//=================================
// Fields and Contstants
//=================================

const ALT_COMPLETION_PARENTS = ["DollarExpr"]
const KEYWORDS = ["if", "else", "for", "in", "while", "repeat", "function"]
const KEYWORD_TYPES = new Array(KEYWORDS.length).fill("keyword")

let savedContext: CompletionContext | null
let savedData: any | null

//=================================
// Completions Extensions
//=================================
export const maincompletions = RLanguage.data.of({
    autocomplete: getMainCompletions
})
export const packagecompletions = RLanguage.data.of({
    autocomplete: getPkgCompletions
})
export const keywordcompletions = RLanguage.data.of({
    autocomplete: getKeywordCompletions
})

export const cleanupExtension = StateField.define<null>({
    create(editorState) {
        return null
    },

    update(docState, transaction) {
        savedContext = null
        savedData = null
       return null
    }
})

function getMainCompletions(context: CompletionContext) {
     //cache data for other completion calls 
     savedContext = context
     savedData = null
 
     let containingNode: SyntaxNode | null = syntaxTree(context.state).resolve(context.pos, -1)
     if (containingNode !== null) {
         //check for trigger token
         let nodeName = containingNode.name
         let parentNode = containingNode.parent
         let docState = getDocState(context.state)
 
         //dollar expression child name completion
         if( parentNode !== null && (nodeName == "DollarExpr" || parentNode.name == "DollarExpr") && getChildIndex(containingNode) == 1 ) {
            let dollarExprNode = containingNode.name == "DollarExpr" ? containingNode : parentNode
            let completions = getDollarExprCompletions(dollarExprNode!, context, docState)
            if (completions !== null) return completions
        }
 
        //general variable completion
         if (nodeName == "Identifier" && parentNode !== null ) {
            //store this info for other completion sources to use
            savedData = {
                type: "Identifier",
                from: containingNode!.from
            }

            //get the completions for globals here
            let completions = getGlblIdentComps(containingNode!, context, docState)
            if (completions !== null) return completions
         }

     }
     return undefined
}

function getPkgCompletions(context: CompletionContext) {
    if(libCompletionVarNames.length == 0) return undefined

    if(savedContext && context.state.doc == savedContext?.state.doc && context.pos == savedContext.pos) {  
        if(savedData && savedData.type == "Identifier") {
            return makeWordListResponse(libCompletionVarNames, libCompletionVarTypes, savedData.from)
        }
    }
    else {
        return undefined
    }
}

function getKeywordCompletions(context: CompletionContext) {
    if(savedContext && context.state.doc == savedContext?.state.doc && context.pos == savedContext.pos) {
        if(savedData && savedData.type == "Identifier") {
            return makeWordListResponse(KEYWORDS, KEYWORD_TYPES, savedData.from)
        }
    }
    else {
        return undefined
    }    
}

//----------------------
// Dollar Sign Completions
//----------------------

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
// General Identifier Completions - Globals
//----------------------

function getGlblIdentComps(identifierNode: SyntaxNode, context: CompletionContext, docState: DocState) {
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

/** This gets the names from a list-type object */
export function getListNames(callerValue: any): string[] | null {
    if (callerValue.fmt == "list" && callerValue.names !== undefined) {
        return callerValue.names.filter((name: string) => name !== "")
    }
    else if (callerValue.fmt == "data.frame" && callerValue.colNames !== undefined) {
        return callerValue.colNames.filter((name: string) => name !== "")
    }
    return null
}