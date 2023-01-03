
source("stateUtil.R")

setDependsOn <- function(state,fieldRecord) {
  fieldNames <- getFieldNames(state)
  flags <- fieldNames %in% fieldRecord$extRef 
  fieldRecord$dependsOnNames <- fieldNames[flags]
  fieldRecord$dependsOnIds <- names(fieldNames)[flags]
  fieldRecord
}

clearDependsOn <- function(fieldRecord) {
  fieldRecord$dependsOnNames <- NULL
  fieldRecord$dependsOnIds <- NULL
  fieldRecord
}

## This checks if the dependencies should be updated for any added or removed name.
## This function only works for 0 or 1 added or removed names.
## If a value of "" is passed in for a name, this will be ignored. (It represents
## a field with no name, and can have no dependencies.)
remoteDependencyNameCheck <- function(state,oldName="",newName="",fromId=id,commandNumber) {
  if((length(oldName) > 1)||(length(newName) > 1)) {
    stop("This function should only be called with a single name!")
  }
  
  for(id in names(state)) {
    if(id != fromId) {
      state <- dependencyNameCheck(state,id,oldName,newName,commandNumber)
    }
  }
  
  state
}

dependencyNameCheck <- function(state,id,oldName="",newName="",commandNumber) {
  
  fieldRecord <- state[[id]]
  
  if( ((!identical(oldName,"")) && (oldName %in% fieldRecord$dependsOnNames)) ||
      ((!identical(newName,"")) && (newName %in% fieldRecord$extRef)) ) {
    ##note - if the new name is in the external references, it should not already
    ##be a dependent since the name is new. (But this will still work if it is.)
    
    ##just recalculate the dependencies
    ##(it might be better to reuse the field names rather than recalculate them each time)
    fieldRecord <- setDependsOn(state,fieldRecord)
    fieldRecord$status <- "dirty"
    fieldRecord$errorInfo <- NULL
    fieldRecord$commandNumber <- commandNumber
    
    state[[id]] <- fieldRecord
  }
  
  state
}



