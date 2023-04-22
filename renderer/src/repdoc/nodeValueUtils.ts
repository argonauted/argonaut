import { SyntaxNode, NodeProp } from "@lezer/common"
import { getDocState, DocState } from "./interactiveCode"
import CellInfo from "./CellInfo"
import { EditorState } from "@codemirror/state"
import { libVarData } from "./sessionPackageData"


//========================================================
// Value Lookup Functions
//========================================================

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

/** This returns the value assocated with an identifier node, which can either
 * represent a variable directly or a child of a variable through an expression,
 * such as the $ expeession. 
 * It returns a vlue structure if the value can be determined and null if not */
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

/** This returns the value of a node, which can be either a simple identifier or
 * an expression. 
 * It returns a vlue expression if the value can be determined and null if not. */
export function getFullNodeValue() {}


//========================================================
// Syntax Node Helper Functions
//========================================================

export function isCellNode(node: SyntaxNode) {
    let groupVal = node.type.prop(NodeProp.group)
    return (groupVal && groupVal[0] == "cell")
}

/** This function gets the cell assocaited with the given node. The node may be a child
 * node of the cell or the cell node itself.  */
export function getAssociatedCellNode(node: SyntaxNode) {
    let cellNode: SyntaxNode | null = node
    while (cellNode !== null && !isCellNode(cellNode)) {
        cellNode = cellNode.parent
    }
    return cellNode
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

//========================================================
// Internal Value Lookup Helper Functions
//========================================================

/** This function returns the value for the given variable name, where the variable is sourced from the "associatedNode". This
 * node should be the identifier giving the variable name, of an parent node up to the containing cell node. */
function getVarValueForCell(varName: string, associatedNode: SyntaxNode, docState: DocState, fromInput=true, functionOnly=false): any {
    let cellNode = getAssociatedCellNode(associatedNode)
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
                if(varValue != undefined && (!functionOnly || varValue.fmt == "function")) {
                    return varValue
                }
            }

        }
    }

    return null
}


//SHOULD THIS BE SOMEWHERE ELSE, LIKE THE VARTABLE FILE?
function getCellEnvValue(varName: string, cellInfo: CellInfo, docState: DocState, functionOnly: boolean) {
    let cellEnv = cellInfo!.cellEnv
    let versionedVarName = cellEnv[varName]
    if (versionedVarName !== undefined) {
        let varTable = docState.varTable
        let varValue = varTable.table[versionedVarName]
        if (varValue !== undefined && (!functionOnly || varValue.fmt == "function")) {
            return varValue
        }
    }
    return null
}

type ValueLookupFunction = (identifierNode: SyntaxNode, state: EditorState, fromInput: boolean, functionOnly: boolean) => {name: string, valueData: any} | null

/** This returns the value of the variable whose name is given by the identifier node passed in. */
function getVarNodeValue(identifierNode: SyntaxNode, state: EditorState, fromInput = true, functionOnly = false) {
    let name = state.doc.sliceString(identifierNode.from,identifierNode.to)
    let docState = getDocState(state)
    let valueData: any = getVarValueForCell(name, identifierNode, docState, fromInput, functionOnly)
    if(valueData != null) {
        return {name, valueData}
    }
    return null
}

/** This returns the value of an identifier node that is part of an ArgValue */
function getArgValueNodeValue(identifierNode: SyntaxNode, state: EditorState, fromInput = true, functionOnly = false) {
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
    
    return getVarNodeValue(identifierNode,state,fromInput,functionOnly)
}

function getParamValueNodeValue(identifierNode: SyntaxNode, state: EditorState, fromInput = true, functionOnly = false) {
    let childIndex = getChildIndex(identifierNode)
    if(childIndex > 0) {
        //the first child is a label, the next is an expression
        return getVarNodeValue(identifierNode,state,fromInput,functionOnly)
    }
    return null
}

function getAssignVarNodeValue(identifierNode: SyntaxNode, state: EditorState, fromInput = true, functionOnly = false) {
    let childIndex = getChildIndex(identifierNode)
    let isLeftIdentifier = childIndex == 0
    let assignNode = isLeftIdentifier ? identifierNode.nextSibling : identifierNode.prevSibling
    if(assignNode === null) return null

    let assignChars = assignNode.type.name
    let isSuper = assignChars == "->>" || assignChars == "<<-"
    let isRhsOp = assignChars == "->" || assignChars == "->>" 

    if(isLeftIdentifier == isRhsOp) {
        //the identifier is not being assigned to
        fromInput = true
        return getVarNodeValue(identifierNode,state,fromInput,functionOnly)
    }
    else {
        //variable is being assigned to - get value from OUTPUT
        //FIX THIS TO ACCOUNT PROPERLY FOR SUPER OPERATOR!!!
        fromInput = false
        return getVarNodeValue(identifierNode,state,fromInput,functionOnly)
    }
}

// function isOpNode(opNode: SyntaxNode) {
//     if(opNode !== null && opNode.type.name == "AssignOp") {
//         if(opNode.firstChild !== null) {
//             opName = opNode.firstChild.type.name
//         }
//     }
// }

function getDollarVarNodeValue(identifierNode: SyntaxNode, state: EditorState, fromInput = true, functionOnly = false) {
    let childIndex = getChildIndex(identifierNode)
    if(childIndex == 0) {
        //norm expression identifier
        return getVarNodeValue(identifierNode,state,fromInput,functionOnly)
    }
    else {
        //fix this to get the child value!!!
        return null
    }
    return null
}
   
function getNamespaceVarNodeValue(identifierNode: SyntaxNode, state: EditorState, fromInput = true, functionOnly = false) {
    return null
}

const parentToValueFuncMap: Record<string,ValueLookupFunction> = {
    "UnaryExpr": getVarNodeValue,
    "BinaryExpr": getVarNodeValue,
    "ParenExpr": getVarNodeValue,
    "Block": getVarNodeValue,
    "IfExpr": getVarNodeValue,
    "RepeatExpr": getVarNodeValue,
    "WhileExpr": getVarNodeValue,
    "Cell": getVarNodeValue,
    "EndCell": getVarNodeValue,

    "StdCall": getVarNodeValue, //this will only be the function name
    "ArgValue":  getArgValueNodeValue, //this is other elements in a StdCall

    "BrckExpr": getVarNodeValue, //this will only be the variable being subset
    "DblBrckExpr": getVarNodeValue, //this will only be the variable being subset
    "SubsetArgValue": getVarNodeValue, //CHNAGE THIS??


    //"FuncDef": contains no identifier
    "ParamValue": getParamValueNodeValue, //this contains all identifiers for the function definition
    
    "AssignExpr": getAssignVarNodeValue,
    "DollarExpr": getDollarVarNodeValue,
    "NamespaceExpr": getNamespaceVarNodeValue,
    

    //"SlotExpr": getSlotVarNodeValue, LATER

}

// these ones require other logic:
// AssignExpr
// - arg 1 or 2 - OUTPUT! (And maybe of parent frame)
// - arg 2 or 1 - normal
// DollarExpr
// - arg 1 - normal
// - arg 2 - evaluate arg1, then get child
// NamespaceExpr
// - arg 1 - MUST BE A PACKAGE NAME!
// - arg 2 - member of package
// SlotExpr
// - SUPPORT LATER
// BrckExpr
// - arg 1 - normal
// - arg 2 - evaluate arg 1, then subset - MAYBE ONLY EVALUATE COMPLET LIST?
// DblBrckExpr
// - arg 1 - normal
// - arg 2 - evaluate arg 1, then subset - MAYBE ONLY EVALUTE COMPLETE LIST?


// ForExpr
// StdCall
// FuncDef

//we can ignore these - these won't be identifier parents
//literal
//Identifier

  


