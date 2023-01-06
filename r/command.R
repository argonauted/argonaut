##################################################
## testing code for exe command
##################################################

source("stateUtil.R")
source("compile.R")
source("calculate.R")
source("dependencies.R")

## This function creates an empty docState
createEmptyDocState <- function() {
  list(success=TRUE,fieldStates=list(),commandNumber=0)
}

##This function executes a command to update the doc state
executeCommand <- function(docState,command,doRecalc=TRUE) {
  
  commandNumber <- getCommandNumber()
  
  if(!("type" %in% names(command))) {
    return(errorReturn("Command type not specified!"),
           commandNumber=commandNumber)
  }
  if(!(command$type %in% names(commandList))) {
    return(errorReturn(sprintf("Invalid command type: %s",command$type)),
           commandNumber=commandNumber)
  }
  
  ##tryCatch({
    cmdFunction <- commandList[[command$type]]
    resultDocState <- cmdFunction(docState$fieldStates,command,commandNumber)
    
    ## set the command number on the output
    resultDocState$commandNumber <- commandNumber
    
    if(resultDocState$success) {

      ## complete the state - update or determine the eval list
      resultDocState <- updateState(resultDocState,commandNumber,doRecalc=doRecalc)
      
      resultDocState
    }
    else {
      ##result from cmd function is our error state
      resultDocState
    }
  ##},
  ##error=function(err) {
  ##  errorReturn(sprintf("Unknown error running command: %s",as.character(err)),
  ##              err=err,
  ##              commandNumber=commandNumber)
  ##})
}

## This function 
calculateField <- function(docState,id) {
  ## require that there is an eval list and that the id evaluated is the first in the eval list.
  if(is.null(docState$evalList)) {
    return(errorReturn("Eval list missing!"),
           commandNumber=docState$commandNumber)
  } 
  if(docState$evalList[1] != id) {
    return(errorReturn(sprintf("Evaluation out of order! expected id=%s, evaluating id=%s",docState$evalList[1],id),
           commandNumber=docState$commandNumber))
  }
  
  docState <- updateField(docState,id,doRecalc=TRUE,errorForDirtyDependsOn=TRUE)
  if(length(docState$evalList) > 1) {
    docState$evalList <- tail(docState$evalList,-1)
  }
  else {
    docState$evalList <- NULL
  }
  
  docState
}

## looks up the id for a given name
getIdWithName <- function(fieldStates,name) {
  for(fieldRecord in fieldStates) {
    if(fieldRecord$name == name) return(fieldRecord$id)
  }
  NULL
}

##===============================
## Testing Code
##===============================

## This resets the command numbers. It should not be done in normal usage
## It is just intended for testing.
resetCommandNumber <- function() {
  lastCommandNumber <<- 0L
}

## This resets the ids. It should not be done in normal usage
## It is just intended for testing.
#resetIds <- function() {
#  lastIdInt <<- 0L
#}

##=======================
## internal functions
##=======================

## make a new id, starting at 1
##lastIdInt <- 0L
##createId <- function() {
##  lastIdInt <<- lastIdInt + 1L
##  sprintf("f%i",lastIdInt)
##}

lastCommandNumber <- 0L
getCommandNumber <- function() {
  lastCommandNumber <<- lastCommandNumber + 1L
}

## This is the command list
## Any command should be added here
commandList = list()

##-------------------------------
## Command Implementations
##-------------------------------
## Command functions should update the state so that it is consistent
## but it can include dirty fields (if applicable). 
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
## - fieldstates - this are the updated field states after the command
## - ... - other fields will be returned to the caller of executeCommand

## This command creates a new field
## content:
## - $type <- "delete" (required)
## - $id <- id for the new fields (required)
## - $name <- new name for a field (optional - include if the field has a name)
## - $code <- code for a field (required)
## - $argList <- argList included for function, omitted for data (optional)
##
## If the code is included with no argList a "data" field will be created.
## If code is included with an argList a "function" field will be created.
## If only an argList is passed, it will be ignored.
##
## If a field is given no name, it can not be referenced by other fields, but it
## can create an output value. To do this, do not set a name on the field. (Or
## alternately, a value of "" can be set.)
commandList$create <- function(fieldStates,command,commandNumber) {
  
  ## id
  if(!"id" %in% names(command) ) {
    return(errorReturn("Field id missing from create command"))
  }
  
  id <- command$id
  if(identical(id,"")) {
    return(errorReturn("Id can not be an empty string"))
  }
  if(id %in% names(fieldStates)) {
    return(errorReturn(sprintf("Id is alredy in use: %s", id)))
  }

      
  
  fieldStates[[id]] <- list(id=id)
  
  ## set name
  if( ("name" %in% names(command))&&(!identical(command$name,"")) ) {
    
    ##---------
    ## Set an empty name as a placeholder.
    ## I'm doing this just because in the name check below I get the names of
    ## all the fields in the fieldStates, and this record would otherwise have an
    ## invalid value NULL.
    ## I should probably get a better solution,
    ## Maybe the record should be created below with all valid fields?
    ## The only thing stopping me now is this could have its own issues.
    fieldStates[[id]]$name <- ""
    ##---------
    
    ##check for valid name
    nameReturn <- checkNameValid(fieldStates,command$name)
    if(!nameReturn$success) {
      return(nameReturn)
    }
    
    fieldStates[[id]]$name <- command$name
    ##check for remote dependency change due to name change
    fieldStates <- remoteDependencyNameCheck(fieldStates,
                                       newName=command$name,
                                       fromId=id,
                                       commandNumber=commandNumber)
  }
  else {
    ## use empty string as a placeholder for no name
    fieldStates[[id]]$name <- ""
  }
  
  ## set code
  if("code" %in% names(command)) {
    fieldStates <- setFieldCode(fieldStates,id,command)
  }
  else {
    return(errorReturn("The create command requires the field 'code'"))
  }
  
  ## command number for command that updated field
  fieldStates[[id]]$commandNumber <- commandNumber 
  
  ##successReturn(fieldStates=fieldStates)
  successReturn(fieldStates=fieldStates,id=id)
} 

## This command updates a field
## content:
## - $type <- "delete" (required)
## - $id <- id of field to update (required)
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
commandList$update <- function(fieldStates,command,commandNumber) {
  if( !("id" %in% names(command)) ) {
    return(errorReturn("Field id missing from update command"))
  }
  
  id <- command$id
  
  if( !(id %in% names(fieldStates)) ) {
    return(errorReturn("id not found in fieldStates list"))
  }
  
  updated <- FALSE
  
  ##set name, if needed
  if( ("name" %in% names(command))&&(!identical(command$name,fieldStates[[id]]$name)) ) {
    
    ##check for valid name (empty string OK here since this means no name)
    if(!identical(command$name,"")) {
      nameReturn <- checkNameValid(fieldStates,command$name)
      if(!nameReturn$success) {
        return(nameReturn)
      }
    }
    
    oldName <- fieldStates[[id]]$name
    fieldStates[[id]]$name <- command$name
    updated <- TRUE
    
    fieldStates <- remoteDependencyNameCheck(fieldStates,
                                       oldName=oldName,
                                       newName=command$name,
                                       fromId=id,
                                       commandNumber=commandNumber)
  }
  
  ## set code (and type), if needed
  if("code" %in% names(command)) {
    fieldStates <- setFieldCode(fieldStates,id,command)
    
    ##later figure out if there was a real change?
    updated <- TRUE
  }
  
  ## command number for command that updated field
  if(updated) {
    fieldStates[[id]]$commandNumber <- commandNumber
  }

  successReturn(fieldStates=fieldStates)
} 

## This command deletes a field
## content:
## - $type <- "delete" (required)
## - $id <- id of field to delete (required)
commandList$delete <- function(fieldStates,command,commandNumber) {
  if( !("id" %in% names(command)) ) {
    return(errorReturn("id missing from command"))
  }
  if( !(command$id %in% names(fieldStates)) ) {
    return(errorReturn("id not found in fieldStates list"))
  }
  
  oldName <- fieldStates[[command$id]]$name
  
  ## remove from fieldStates
  fieldStates[command$id] <- NULL
  
  ##check for remote dependency change due to name change
  fieldStates <- remoteDependencyNameCheck(fieldStates,
                                     oldName=oldName,
                                     fromId=command$id,
                                     commandNumber=commandNumber)
  
  successReturn(fieldStates=fieldStates)
} 

##===============================
## Utilities
##===============================

## This function sets the cpompiled code fields for a record
## including the dependencies
## In the case of a parse error, it sets the status to "error"
setFieldCode <- function(fieldStates,id,command) {
  fieldRecord <- fieldStates[[id]]
  
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
    fieldRecord <- setDependsOn(fieldStates,fieldRecord)
    fieldRecord$status <- "dirty"
    fieldRecord$errorInfo <- NULL
    
    fieldStates[[id]] <- fieldRecord
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
  
  fieldStates[[id]] <- fieldRecord

  fieldStates
}


  

