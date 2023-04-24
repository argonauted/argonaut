/** This document provides some utility functions for manipulating nodes of the parsed document tree. */

import { SyntaxNode, NodeProp } from "@lezer/common"
import { DocState } from "./repdocState"

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

/** This function gets the cell assocaited with the given node. The node may be a child
 * node of the cell or the cell node itself.  */
export function getParentCellNodes(node: SyntaxNode | null) {
    let cellNodes: SyntaxNode[] = []
    while (node !== null) {
        if(isCellNode(node)) cellNodes.push(node)
        node = node.parent
    }
    return cellNodes
}
