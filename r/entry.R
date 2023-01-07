library(rlang)
library(jsonlite)

source("command.R")


executeApogeeCommand <- function(cmd) {
  mainEnv <- caller_env()
  docState <- get("docState",envir <- mainEnv,inherits=FALSE)
  
  newDocState <- executeCommand(docState,cmd,doRecalc=FALSE)
  if(newDocState$success) {
    assign("docState",newDocState,envir=mainEnv)
    issueReturn(list(success=unbox(TRUE),evalList=newDocState$evalList))
  }
  else {
    issueReturn(list(success=unbox(FALSE),msg=newDocState$msg))
  }
}

calculateApogeeField <- function(fieldId) {
  mainEnv <- caller_env()
  docState <- get("docState",envir <- mainEnv,inherits=FALSE)
  newDocState <- calculateField(docState,fieldId)
  if(newDocState$success) {
    assign("docState",newDocState,envir=mainEnv)
    issueReturn(list(success=unbox(TRUE)))
  }
  else {
    issueReturn(list(success=unbox(FALSE),msg=newDocState$msg))
  }
}

issueReturn <- function(retVal) {
  print(toJSON(retVal))
}

