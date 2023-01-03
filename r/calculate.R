source("stateUtil.R")

recalculateState <- function(state,commandNumber) {
  
  if(length(state) == 0) return(state)
  
  ## For any field that changed during this command number, we should set
  ## any fields that depend on it dirty (if appropriate, see below)
  for(id in names(state)) {
    if(state[[id]]$commandNumber == commandNumber) {
      state <- setImpactsFieldsDirty(state,id,commandNumber)
    }
  }
  
  ## get all dirty fields
  dirtyIds <- names(state)[sapply(state,function(fr) (fr$status == "dirty") )]
  
  ## recalculate all dirty ids
  ## note - when one is recalculated, fields it depends on may also be recalculated
  for(id in dirtyIds) {
    if(state[[id]]$status == "dirty") {
      state <- recalculateField(state,id,path=character())
    }
  }
  
  state
}

## This function (recursively) updates the status of any field that depends on rootId,
setImpactsFieldsDirty <- function(state,rootId,commandNumber) {
  for(id in names(state)) {
    ## check if any fields should be set to dirty based on rootId changing
    if(shouldBeSetDirty(state[[id]],rootId,commandNumber)) {
      
      ## this shouldn't happen, but make sure anyway
      ## it is an error in the code
      if(state[[id]]$status == "dirty") {
        stop("Unknown error! field unexpectedly dirty")
      }
      
      state[[id]]$status <- "dirty"
      state[[id]]$commandNumber <- commandNumber
      
      ##set fields that depend on this one dirty
      state <- setImpactsFieldsDirty(state,id,commandNumber)
    }
  }
  state
}

## This function determines if a field should be marked as dirty
## if a field it depends on changed during the current command
## and it did not also change during this command
## (this means it should not be dirty. If it is set dirty,
## then the command number should be set to the current command number)
shouldBeSetDirty <- function(fieldRecord,rootId,commandNumber) {
  (rootId %in% fieldRecord$dependsOnIds) &&
    (fieldRecord$commandNumber != commandNumber)
}

## This method calculates the value for a field. It will also calculate the 
## values of any dirty fields that this one depends on.
recalculateField <- function(state,id,path) {
  fieldRecord <- state[[id]]
  
  ## check init is not already in process
  ## I THINK I WON'T GET IN HERE EVER
  if(fieldRecord$status != "dirty") {
    stop("Unknown error: non-dirty field sent to recalculate")
  }
  
  ##FIGURE OUT WHAT ENVIRONMENT I WANT TO USE!!!
  fieldCalcEnv <- new_environment(parent = current_env())
  
  ## set status as the appropriate init state
  if(fieldRecord$type == "data") {
    ## data - no value can be set until we load dependencies into environment
    fieldRecord$status <- "initnv"
  }
  else {
    ## function - set init state with value loaded. Load dep later.
    fieldRecord$status <- "initv"
    ##set value to the field function itself
    ##I DON'T KNOW IF THIS WORKS RIGHT, DO I NEED A SUPER ASSINGN?
    fieldRecord <- tryCatch({
      fieldRecord$value <- eval(fieldRecord$fieldExpr,fieldCalcEnv)
      fieldRecord
    },
    error=function(err) {
      fieldRecord$status <- "error"
      fieldRecord$errorInfo <- as.charcter(err)
      fieldRecord
    })
  }
  
  if(state[[id]]$status != "error") {
    ##-----------------------------------------------------
    ##load our working field record back into the state here!
    state[[id]] <- fieldRecord
    dependsOnIds <- fieldRecord$dependsOnIds
    childPath <- c(path,id)
    
    ## set value of dependencies in environment, initialize them if needed
    excDepData <- list()
    for(did in dependsOnIds) {
      ## recalc field if needed
      if(state[[did]]$status == "dirty") {
        state <- recalculateField(state,did,childPath)
      }
      
      ## check state of dependent
      depRecord <- state[[did]]
      depStatus <- depRecord$status
  
      if(canBeAssigned(depStatus=depStatus,thisType=state[[id]]$type)) {
        ## load depends on value into calc environment
        assign(depRecord$name,depRecord$value,envir = fieldCalcEnv)
      }
      else if(isCircularError(depStatus=depStatus,thisType=state[[id]]$type)) {
        ## circular reference first detected
        excDepData[[did]] <- createCircularErrorInfo(childPath,did)
      }
      else {
        ##error in dependency
        excDepData[[did]] <- createErrorInfo(type=depStatus,errorInfo=depRecord$errorInfo)
      }
      
      fieldRecord <- state[[id]]
      ##get the updated field record again!
      ##------------------------------------
    }
    
    ##check for exceptional dependency status
    if(length(excDepData) > 0) {
      fieldRecord$status <- "excepdep"
      fieldRecord$errorInfo <- excDepData
      fieldRecord$value <- NA
    }
    else {
      ## status normal, so far
      if(fieldRecord$type == "data") {
        ## evaluate field function for value
        ##I DON'T KNOW IF THIS WORKS RIGHT, DO I NEED A SUPER ASSINGN?
        fieldRecord <- tryCatch({
          fieldFunction <- eval(fieldRecord$fieldExpr,fieldCalcEnv)
          fieldRecord$value <- fieldFunction()
          fieldRecord$status <- "normal"
          fieldRecord$errorInfo <- NULL
          fieldRecord
        },
        error=function(err) {
          fieldRecord$status <- "error"
          fieldRecord$errorInfo <- createErrorInfo(type="evaluation",msg=as.character(err))
          fieldRecord$value <- NA
          fieldRecord
        })
      }
      else {
        ## set status normal
        fieldRecord$status <- "normal"
        fieldRecord$errorInfo <- NULL
      }
    }
  }
  
  state[[id]] <- fieldRecord
  state
}

## This function returns true if a field of type "thisType" can use a value from a field it depends on
canBeAssigned <- function(depStatus,thisType) {
  ##for data fields: depends on field must be ready to calculate (since we will evaluate the function)
  ##for function fields: depends on field must be set. We will not evaluate the function yet though.
  ## (this allows circular references for functions)
  ((thisType == "data")&&(depStatus == "normal")) || 
    ((thisType == "function")&&((depStatus == "normal")||(depStatus == "initv")))
}

## This function returns true if a circular error is detected. Circular references for functions
## are OK but circular references for data do not allow a proper calculation (without some
## clever reasoning, like maybe an iterative solution)
isCircularError <- function(depStatus,thisType) {
  ##for data fields: depends on field must be ready to calculate (since we will evaluate the function)
  ##for function fields: depends on field must be set. We will not evaluate the function yet though.
  ## (this allows circular references for functions)
  ((thisType == "data")&&((depStatus == "initnv")||(depStatus == "initv"))) || 
    ((thisType == "function")&&(depStatus == "initnv"))
}

createCircularErrorInfo <- function(path,startId) {
  ##errors if start id is not in path. Should not happen
  ##but we don't test for it since our recorver would be to throw an error
  circularPath <- tail(path,(length(path) - which(path==startId) + 1) )
  createErrorInfo(type="circular",path=circularPath)
}




