## state utilities

errorReturn <- function(msg,...) {
  list(success=FALSE,msg=msg,...)
}

successReturn <- function(...) {
  list(success=TRUE,...)
}

createErrorInfo <- function(type,...) {
  list(type=type,...)
}

## This function retrieves a vector of field name, with the associated name
## being the field id.
getFieldNames <- function(fieldStates) {
  fieldNames <- sapply(fieldStates,function(fieldRecord) fieldRecord$name)
  fieldNames[ (!is.null(fieldNames)) & (fieldNames != "")]
}


checkNameValid <- function(fieldStates,name) {
  ##-------------
  ## Must be character vector of length 1
  ##-------------
  if(class(name) != "character") return(errorReturn("Name must be character class"))
  ## note this is vector length, not string length
  if(length(name) != 1) return(errorReturn("Name value should not be a vector of length=0 or length>1"))
  
  ##--------------
  ## Field name should be a valid R name
  ##--------------
  #note we have restricted the name to be a character from above linees
  if(make.names(name) != name) return(errorReturn(sprintf("Name is not valid name: %s",name)))
  
  ##------------
  ## Check the name is not in use
  ##------------
  fieldNames <- getFieldNames(fieldStates)
  if(name %in% fieldNames) return(errorReturn(sprintf("The name '%s' is in use",name)))
  
  ##if we get here we are OK
  successReturn()
}
