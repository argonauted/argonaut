##################################################
## testing code for exe command
##################################################

source("stateUtil.R")
source("compile.R")
source("calculate.R")
source("dependencies.R")

executeCommand <- function(state,command) {
  
  commandNumber <- getCommandNumber()
  
  if(!("type" %in% names(command))) {
    return(errorReturn("Command type not specified!"),
           commandNumber=commandNumber)
  }
  if(!(command$type %in% names(commandList))) {
    return(errorReturn(sprintf("Invalid command type: %s",command$type)),
           commandNumber=commandNumber)
  }
  
  tryCatch({
    cmdFunction <- commandList[[command$type]]
    result <- cmdFunction(state,command,commandNumber)
    
    ## set the command number on the output
    result$commandNumber <- commandNumber
    
    if(result$success) {
      ## recalculate the state
      ## retain any other fields fom the command result (like id for create)
      result$state <- recalculateState(result$state,commandNumber)
      
      result
    }
    else {
      ##result from cmd function is our error state
      result
    }
  },
  error=function(err) {
    errorReturn(sprintf("Unknown error running command: %s",as.character(err)),
                err=err,
                commandNumber=commandNumber)
  })
}

## make a new id, starting at 1
lastIdInt <- 0L
createId <- function() {
  lastIdInt <<- lastIdInt + 1L
  sprintf("f%i",lastIdInt)
}

lastCommandNumber <- 0L
getCommandNumber <- function() {
  lastCommandNumber <<- lastCommandNumber + 1L
}

## This resets the ids. It should not be done in normal usage
## It is just intended for testing.
resetIds <- function() {
  lastIdInt <<- 0L
}

## This resets the command numbers. It should not be done in normal usage
## It is just intended for testing.
resetCommandNumber <- function() {
  lastCommandNumber <<- 0L
}

## This is the command list
## Any command should be added here
commandList = list()

##===============================
## Command Implementations
##===============================
## Command functions should update the state so that it is consistent
## but it can include dirty fields (if applicable). The state will be 
## recalculated in the executeCommand function.
##
## It should be assumed that only one field will have its name or code fields
## changed at a time. The only other fields that change should be
## fields that add or lose a depends on field because of a name change to the 
## field in this command.
##
## Any field that does change should have the command number set to the 
## current command number.
##
## The return value of the field should be a list with the following entries:
## - success - TRUE or FALSE (required)
## - msg - this is the error message success = false (optional)
## - state - this is the updated state after the command
## - ... - other fields will be returned to the caller of executeCommand

## This command creates a new field
## content:
## - $type <- "delete" (required)
## - $name <- new name for a field (optional - include if the field has a name)
## - $code <- code for a field (required)
## - $argList <- argList included for function, omitted for data (optional)
##
## If the code is included with no argList a "data" field will be created.
## If code is included with an argList a "function" field will be created.
## If only an argList is passed, it will be ignored.
##
## If a field is given no name, it can not be referenced by other fields, but it
## can create an output value. TO do this, do not set a name on the field. (Or
## alternately, a value of "" can be set.)
commandList$create <- function(state,command,commandNumber) {
  
  ## id
  id <- createId()
  state[[id]] <- list(id=id)
  
  ## set name
  if( ("name" %in% names(command))&&(!identical(command$name,"")) ) {
    
    ##---------
    ## Set an empty name as a placeholder.
    ## I'm doing this just because in the name check below I get the names of
    ## all the fields in the state, and this record would otherwise have an
    ## invalid value NULL.
    ## I should probably get a better solution,
    ## Maybe the record should be created below with all valid fields?
    ## The only thing stopping me now is this could have its own issues.
    state[[id]]$name <- ""
    ##---------
    
    ##check for valid name
    nameReturn <- checkNameValid(state,command$name)
    if(!nameReturn$success) {
      return(nameReturn)
    }
    
    state[[id]]$name <- command$name
    ##check for remote dependency change due to name change
    state <- remoteDependencyNameCheck(state,
                                       newName=command$name,
                                       fromId=id,
                                       commandNumber=commandNumber)
  }
  else {
    ## use empty string as a placeholder for no name
    state[[id]]$name <- ""
  }
  
  ## set code
  if("code" %in% names(command)) {
    state <- setFieldCode(state,id,command)
  }
  else {
    return(errorReturn("The create command requires the field 'code'"))
  }
  
  ## command number for command that updated field
  state[[id]]$commandNumber <- commandNumber 
  
  successReturn(state=state,id=id)
} 

## This command updates a field
## content:
## - $type <- "delete" (required)
## - $id <- id of field to delete (required)
## - $name <- new name for a field (optional - include if the field name changes)
## - $code <- code for a field (optional - include if the field code and/or argList change)
## - $argList <- argList for a field (optional - include if the field code and/or the argList change)
##
## To represent a field with no name, a value of "" is used. (So to clear an
## existing name, set "" as the name.)
##
## If the code is included with no argList a "data" field will be created.
## If code is included with an argList a "function" field will be created.
## If only an argList is passed, it will be ignored.
commandList$update <- function(state,command,commandNumber) {
  if( !("id" %in% names(command)) ) {
    return(errorResult("Field id missing from update command"))
  }
  
  id <- command$id
  
  if( !(id %in% names(state)) ) {
    return(errorReturn("id not found in state list"))
  }
  
  updated <- FALSE
  
  ##set name, if needed
  if( ("name" %in% names(command))&&(!identical(command$name,state[[id]]$name)) ) {
    
    ##check for valid name (empty string OK here since this means no name)
    if(!identical(command$name,"")) {
      nameReturn <- checkNameValid(state,command$name)
      if(!nameReturn$success) {
        return(nameReturn)
      }
    }
    
    oldName <- state[[id]]$name
    state[[id]]$name <- command$name
    updated <- TRUE
    
    state <- remoteDependencyNameCheck(state,
                                       oldName=oldName,
                                       newName=command$name,
                                       fromId=id,
                                       commandNumber=commandNumber)
  }
  
  ## set code (and type), if needed
  if("code" %in% names(command)) {
    state <- setFieldCode(state,id,command)
    
    ##later figure out if there was a real change?
    updated <- TRUE
  }
  
  ## command number for command that updated field
  if(updated) {
    state[[id]]$commandNumber <- commandNumber
  }

  successReturn(state=state)
} 

## This command deletes a field
## content:
## - $type <- "delete" (required)
## - $id <- id of field to delete (required)
commandList$delete <- function(state,command,commandNumber) {
  if( !("id" %in% names(command)) ) {
    return(errorReturn("id missing from command"))
  }
  if( !(command$id %in% names(state)) ) {
    return(errorReturn("id not found in state list"))
  }
  
  oldName <- state[[command$id]]$name
  
  ## remove from state
  state[command$id] <- NULL
  
  ##check for remote dependency change due to name change
  state <- remoteDependencyNameCheck(state,
                                     oldName=oldName,
                                     fromId=command$id,
                                     commandNumber=commandNumber)
  
  successReturn(state=state)
} 

##===============================
## Utilities
##===============================

## This function sets the cpompiled code fields for a record
## including the dependencies
## In the case of a parse error, it sets the status to "error"
setFieldCode <- function(state,id,command) {
  fieldRecord <- state[[id]]
  
  if("argList" %in% names(command)) {
    fieldRecord$type <- "function"
    argList <- command$argList
  }
  else {
    fieldRecord$type <- "data"
    argList <- character()
  }
  
  ## set code and arg list
  fieldRecord$code <- command$code
  fieldRecord$argList <- argList
  
  ##get expression and dependency info
  codeInfo <- compileCode(fieldRecord$argList, fieldRecord$code)
  if(codeInfo$success) {
    fieldRecord$fieldExpr <- codeInfo$expr
    fieldRecord$extRef <- codeInfo$extRef
    fieldRecord <- setDependsOn(state,fieldRecord)
    fieldRecord$status <- "dirty"
    fieldRecord$errorInfo <- NULL
    
    state[[id]] <- fieldRecord
  }
  else {
    ##clear the code values and mark an error
    fieldRecord$fieldExpr <- NULL
    fieldRecord$extRef <- NULL
    fieldRecord <- clearDependsOn(fieldRecord)
    fieldRecord$status <- "error"
    fieldRecord$errorInfo <- createErrorInfo(type="parse",msg=as.character(codeInfo$msg))
    ## set field value to NA
    fieldRecord$value <- NA
  }
  
  state[[id]] <- fieldRecord

  state
}

##===============================
## Testing Code
##===============================

## These are our commands
getIdWithName <- function(state,name) {
  for(fieldRecord in state) {
    if(fieldRecord$name == name) return(fieldRecord$id)
  }
  NULL
}


runTest <- function() {
  state <- list()
  
  code_a_1 <- '100'
  c1 <- list(type="create",name="a",code=code_a_1)
  result <- executeCommand(state,c1)
  
  state <- result$state
  
  code_foo_1 <- '2*x'
  argList_foo_1 <- "x"
  c2 <- list(type="create",name="foo",code=code_foo_1,argList=argList_foo_1)
  result <- executeCommand(state,c2)
  
  state <- result$state
  
  code_c_1 <- '300'
  c4 <- list(type="create",name="c",code=code_c_1)
  result <- executeCommand(state,c4)
  cId <- result$id
  
  state <- result$state
  
  code_c_2 <- '2 + a + d'
  c5 <- list(type="update",id=cId,name="cAlt",code=code_c_2)
  result <- executeCommand(state,c5)
  
  state <- result$state
  
  code_d_1 <- '35'
  c6 <- list(type="create",name="d",code=code_d_1)
  result <- executeCommand(state,c6)
  
  print(result)
}

##runTest()
  

