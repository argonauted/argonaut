import { SyntaxNode, NodeProp } from "@lezer/common"
import { getDocState, DocState } from "./interactiveCode"
import CellInfo from "./CellInfo"
import { EditorState } from "@codemirror/state"
import { libVarData } from "./sessionPackageData"

//========================================================
// Helper Functions
//========================================================

export function isCellNode(node: SyntaxNode) {
    let groupVal = node.type.prop(NodeProp.group)
    return (groupVal && groupVal[0] == "cell")
}

/** This function can be called to get the caller value of a expression node
 * for cases where the caller is the first node in the expression node.
 */
export function getCallerValue(exprNode: SyntaxNode, state: EditorState, docState: DocState): any | null {
    let callerNode = exprNode.firstChild
    //for now only process an identifier
    if (callerNode !== null && callerNode.name == "Identifier" ) {
        let varName = state.doc.sliceString(callerNode.from, callerNode.to)
        return getVarValueForCell(varName, callerNode, docState)
    }
    return null
}

/** This function gets the parent cell for a content node (it assumes the cell is not an empty cell) */
export function getParentCellNode(node: SyntaxNode) {
    let cellNode: SyntaxNode | null = node
    while (cellNode !== null && !isCellNode(cellNode)) {
        cellNode = cellNode.parent
    }
    return cellNode
}

export function getIdentifierNodeValue(identifierNode: SyntaxNode, state: EditorState, fromInput: boolean, functionOnly: boolean) {
    let parentNode = identifierNode.parent
    if(parentNode !== null) {
        let lookupFunc = parentToValueFuncMap[parentNode.name]
        if(lookupFunc) {
            return lookupFunc(identifierNode,state,fromInput,functionOnly)
        } 
    }
    return null
}

export function getVarValueForCell(varName: string, cellOffspringNode: SyntaxNode, docState: DocState, fromInput=true, functionOnly=false): any {
    let cellNode = getParentCellNode(cellOffspringNode)
    if(cellNode !== null) {
        let lookupNode = fromInput ? getPrevCellNode(cellNode) : cellNode
        //NOTE - I NEED TO HANDLE FIRST LINE. IT WILL TAKE A DIFFERENT LOOKUP
        if(lookupNode !== null) {
            //lokup value from cell (must update when we process functions blocks)
            let reqCellInfo = getCellInfo(lookupNode, docState)
            if (reqCellInfo !== null && reqCellInfo!.isUpToDate()) {
                let varValue = getCellEnvValue(varName, reqCellInfo, docState, functionOnly)
                if(varValue) {
                    return varValue
                }
            }

            //look up value from packages
            for(let i=0; i< libVarData.length; i++) {
                let varValue = libVarData[i].var[varName]
                if(varValue != undefined && (!functionOnly || varValue.type == "function")) {
                    return varValue
                }
            }

        }
    }

    return null
}

export function getCellEnvValue(varName: string, cellInfo: CellInfo, docState: DocState, functionOnly: boolean) {
    let cellEnv = cellInfo!.cellEnv
    let versionedVarName = cellEnv[varName]
    if (versionedVarName !== undefined) {
        let varTable = docState.varTable
        let varValue = varTable.table[versionedVarName]
        if (varValue !== undefined && (!functionOnly || varValue.type == "function")) {
            return varValue
        }
    }
    return null
}

export function getPrevCellNode(cellNode: SyntaxNode) {
    //WILL BE NULL FOR FIRST LINE
    return cellNode.prevSibling
}


export function getCellInfo(cellNode: SyntaxNode, docState: DocState) {
    if (cellNode !== null) {
        let prevCellInfo = docState.cellInfos.find(cellInfo => cellInfo.from == cellNode!.from)
        //DOH! I probably need to check if the new editor state matches the doc state 
        if (prevCellInfo !== undefined) {
            return prevCellInfo
        }
    }
    return null
}

/** Returns the index of the child node in the parent. Returns -1 if the child is not in the parent. */
export function getChildIndex(childNode: SyntaxNode) {
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

