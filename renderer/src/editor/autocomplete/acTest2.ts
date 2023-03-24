import {syntaxTree} from "@codemirror/language"
import {CompletionContext} from "@codemirror/autocomplete"
import { SyntaxNode, NodeType } from "@lezer/common"
import { getAutocomplete } from "../../session/sessionApi"

// const tagOptions = [
//   "constructor", "deprecated", "link", "param", "returns", "type"
// ].map(tag => ({label: "@" + tag, type: "keyword"}))

export function acTest2(context: CompletionContext) {
  let containingNode: SyntaxNode | null = syntaxTree(context.state).resolve(context.pos,-1)
  if(containingNode !== null) {
    //check this is a symbol of interest
    if(isMemberSymbol(containingNode.type)) {
      let parentNode = containingNode.parent
      //check the chain up to the bineary expression we are checking
      if(parentNode !== null && parentNode.name == "MemberOp") {
        let grandParentNode = parentNode.parent
        if(grandParentNode !== null && grandParentNode.name == "BinaryExpr") {
          //get the expression/identifier on which member is called and get the complete line up the the current point
          let calleeNode = grandParentNode.firstChild
          if(calleeNode !== null) {
            let calleeText = context.state.doc.sliceString(calleeNode.from,calleeNode.to)
            let cellNode = getCellNode(grandParentNode)
            if(cellNode !== null) {
              let lineText = context.state.doc.sliceString(cellNode.from,containingNode.to)

              context.state.field()

              //check autocomplete here!
              return getAutocompleteResult(calleeText,lineText,containingNode.to)
            }
          }
        }
      }
    }
  }
  return null
  // if (nodeBefore.name != "BlockComment" ||
  //     context.state.sliceDoc(nodeBefore.from, nodeBefore.from + 3) != "/**")
  //   return null
  // let textBefore = context.state.sliceDoc(nodeBefore.from, context.pos)
  // let tagBefore = /@\w*$/.exec(textBefore)
  // if (!tagBefore && !context.explicit) return null
  // return {
  //   from: tagBefore ? nodeBefore.from + tagBefore.index : context.pos,
  //   options: tagOptions,
  //   validFor: /^(@\w*)?$/
  // }
}

function getAutocompleteResult(/*docSessionId: string, prevLineId: string, */calleeText: string, lineText: string, memberStartPosition: number) {
  console.log(`Check autocomplete: callee: ${calleeText}, line: ${lineText}`)
  //return getAutocomplete(docSessionId,prevLineId,calleeText,lineText).then(data => null)
  return Promise.resolve({
    from: memberStartPosition,
    options: [
      {label: "a", type: "something"},
      {label: "bb", type: "something"},
      {label: "ccc", type: "something"}
    ],
    validFor: /^(@\w*)?$/
  })
}

function isMemberSymbol(nodeType: NodeType) {
  return (nodeType.name == "$" || nodeType.name == "@" || nodeType.name == "::" || nodeType.name == ":::")
}


function isCell(nodeType: NodeType) {
  return nodeType.name == "Cell" || nodeType.name == "EndCell"  || nodeType.name == "EmptyCell" || nodeType.name == "EmptyEnd" //the last two will not happen here becoase of the resolve statement
}

function getCellNode(node: SyntaxNode | null) {
  while(node !== null) {
    if(isCell(node.type)) {
      return node
    }
    node = node.parent
  }
  return null
}