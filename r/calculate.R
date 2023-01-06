source("stateUtil.R")


updateState <- function(docState,commandNumber,doRecalc=TRUE) {
  
  if(length(docState$fieldStates) == 0) return(docState)
  
  ## For any field that changed during this command number, we should set
  ## any fields that depend on it dirty (if appropriate, see below)
  for(fieldRecord in docState$fieldStates) {
    if(fieldRecord$commandNumber == commandNumber) {
      docState$fieldStates <- setImpactsFieldsDirty(docState$fieldStates,fieldRecord$id,commandNumber)
    }
  }
  
  if(!doRecalc) {
    ##create some working variables for later recalc
    docState$evalList <- character()
    docState$virtualStatus <- sapply(docState$fieldStates,function(fr) fr$status)
  }
  
  ## recalculate all dirty ids
  ## note - when one is recalculated, fields it depends on may also be recalculated
  for(fieldRecord in docState$fieldStates) {
    if(fieldRecord$status == "dirty") {
      docState <- updateField(docState,fieldRecord$id,doRecalc=doRecalc)
    }
  }
  
  if(!doRecalc) {
    ##this was just temporary
    docState$virtualStatus <- NULL
  }
  
  docState
}

## This method calculates the value for a field. It will also calculate the 
## values of any dirty fields that this one depends on.
updateField <- function(docState,id,doRecalc=TRUE,errorForDirtyDependsOn=FALSE,path=character()) {
  
  fieldType <- docState$fieldStates[[id]]$type
  
  ##-----------------------------------------------------
  ##initialize before including depends on fields
  ##-----------------------------------------------------
  if(doRecalc) {
    fieldCalcEnv <- new_environment(parent = current_env())
  }
  
  if(fieldType == "data") {
    ## data fields - we must load depends on values into environment before evaluation
    if(doRecalc) {
      docState$fieldStates[[id]]$status <- "initnv"
    }
    else {
      ##no state update for recalc
      docState$virtualStatus[[id]] <- "initnv"
    }
    
  }
  else {
    ## function fields - we can evaluate function before loading depends on into environment
    if(doRecalc) {
      fieldRecord <- docState$fieldStates[[id]]
      
      fieldRecord$status <- "initv"
      fieldRecord <- tryCatch({
        fieldRecord$value <- eval(fieldRecord$fieldExpr,fieldCalcEnv)
        fieldRecord
      },
      error=function(err) {
        fieldRecord$status <- "error"
        fieldRecord$errorInfo <- as.charcter(err)
        fieldRecord
      })
      
      docState$fieldStates[[id]] <- fieldRecord
    }
    else {
      ##no state update for recalc, but add to eval list here
      docState$virtualStatus[[id]] <- "initv"
      docState$evalList <- c(docState$evalList,id)
    }
  }
  
  if(docState$fieldStates[[id]]$status != "error") { ## error happens when we fail in evaluating a function field - final stata alreade set
    
    dependsOnIds <- docState$fieldStates[[id]]$dependsOnIds
    childPath <- c(path,id)
    
    ##-----------------------------------------------------
    ## load value of depends on in environment or record depends on error
    ## initialize depends on if needed
    ##-----------------------------------------------------
    excDepData <- list()
    for(did in dependsOnIds) {
      ## calculate depends on field if needed
      dependsOnStatus <- if(doRecalc) docState$fieldStates[[did]]$status else docState$virtualStatus[[did]]
      if(dependsOnStatus == "dirty") {
        ##This is added for the case of calculating the field independently
        if(errorForDirtyDependsOn) {
          stop("Error: Dirty Depends On found!!!")
        }
        
        docState <- updateField(docState,did,doRecalc,errorForDirtyDependsOn,childPath)
      }
      
      ## check status of dependent
      depRecord <- docState$fieldStates[[did]]
      dependsOnStatus <- if(doRecalc) depRecord$status else docState$virtualStatus[[did]]
      
      if(isCircularError(dependsOnStatus=dependsOnStatus,thisType=fieldType)) {
        ## Look for circular error whether or not we are doing recalc
        excDepData[[did]] <- createCircularErrorInfo(childPath,did)
      }
      else if(canBeAssigned(dependsOnStatus=dependsOnStatus,thisType=fieldType)) {
        if(doRecalc) {
          ## load depends on value into calc environment
          assign(depRecord$name,depRecord$value,envir = fieldCalcEnv)
        }
      }
      else {
        ##error in dependency
        excDepData[[did]] <- createErrorInfo(type=dependsOnStatus,errorInfo=depRecord$errorInfo)
      }
    }
    
    ##-----------------------------------------------------
    ## Complete update of field
    ##-----------------------------------------------------
    
    ##check for exceptional dependency status
    if(length(excDepData) > 0) {
      ##update this for doRecalc or not
      ##for no recalc, this will arise from a circular reference error
      docState$fieldStates[[id]]$status <- "excepdep"
      docState$fieldStates[[id]]$errorInfo <- excDepData
      docState$fieldStates[[id]]$value <- NA
      
      if(!doRecalc) {
        docState$virtualStatus[[id]] <- "excepdep"
      }
    }
    else if(doRecalc) {
      fieldRecord <- docState$fieldStates[[id]]
      
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
      
      docState$fieldStates[[id]] <- fieldRecord
    }
    else {
      ##no recalc - all goes to state normal
      if(fieldType == "data") {
        ##add to eval list
        docState$evalList <- c(docState$evalList,id)
      }
      docState$virtualStatus[[id]] <- "normal"
    }
  }
  
  docState
}

##===================
## internal functions
##===================

## This function (recursively) updates the status of any field that depends on rootId,
setImpactsFieldsDirty <- function(fieldStates,rootId,commandNumber) {
  for(id in names(fieldStates)) {
    ## check if any fields should be set to dirty based on rootId changing
    if(shouldBeSetDirty(fieldStates[[id]],rootId,commandNumber)) {
      
      ## this shouldn't happen, but make sure anyway
      ## it is an error in the code
      if(fieldStates[[id]]$status == "dirty") {
        stop("Unknown error! field unexpectedly dirty")
      }
      
      fieldStates[[id]]$status <- "dirty"
      fieldStates[[id]]$commandNumber <- commandNumber
      
      ##set fields that depend on this one dirty
      fieldStates <- setImpactsFieldsDirty(fieldStates,id,commandNumber)
    }
  }
  fieldStates
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


## This function returns true if a field of type "thisType" can use a value from a field it depends on
canBeAssigned <- function(dependsOnStatus,thisType) {
  ##for data fields: depends on field must be ready to calculate (since we will evaluate the function)
  ##for function fields: depends on field must be set. We will not evaluate the function yet though.
  ## (this allows circular references for functions)
  ((thisType == "data")&&(dependsOnStatus == "normal")) || 
    ((thisType == "function")&&((dependsOnStatus == "normal")||(dependsOnStatus == "initv")))
}

## This function returns true if a circular error is detected. Circular references for functions
## are OK but circular references for data do not allow a proper calculation (without some
## clever reasoning, like maybe an iterative solution)
isCircularError <- function(dependsOnStatus,thisType) {
  ##for data fields: depends on field must be ready to calculate (since we will evaluate the function)
  ##for function fields: depends on field must be set. We will not evaluate the function yet though.
  ## (this allows circular references for functions)
  ((thisType == "data")&&((dependsOnStatus == "initnv")||(dependsOnStatus == "initv"))) || 
    ((thisType == "function")&&(dependsOnStatus == "initnv"))
}

createCircularErrorInfo <- function(path,startId) {
  ##errors if start id is not in path. Should not happen
  ##but we don't test for it since our recorver would be to throw an error
  circularPath <- tail(path,(length(path) - which(path==startId) + 1) )
  createErrorInfo(type="circular",path=circularPath)
}




