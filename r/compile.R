library(rlang)


##=====================
##  Public Functions
##=====================

compileCode <- function(argList, codeText) {
  
  tryCatch({
    fieldFunction <- sprintf("function(%s) {\n%s\n}",paste(argList,collapse=", "),codeText)
    fieldExpr <- parse_expr(fieldFunction)
    
    ## OLD METHOD
    ##varInfo <- list(stack=list(),references=numeric())
    ##varInfo <- processExpression(varInfo,fieldExpr)
    
    #return codeInfo
    ##list(success=TRUE,expr=fieldExpr,extRef=varInfo$references)
    
    successReturn(expr=fieldExpr,extRef=getExternalReferences(fieldExpr))
  },
  error=function(err) {
    errorReturn(msg=as.character(err))
  })
}

##=====================
## ALTERNATE METHOD
##=====================

## Here I get the external references with the built in function findGlobals.
## We need to do better than this, but that will be very difficult.
getExternalReferences <- function(fieldExpr) {
  fieldFunction <- eval(fieldExpr)
  codetools::findGlobals(fieldFunction)
}

##=====================
## Internal Functions
##=====================

## This is my own code to get external references. The most notable thing it
## doesn't do is LHS function calls for the assign operator, in addition to
## all the shortcomings of findGlobals, used above

## varInfo = list(stack=stack,references=references)
## stack - list of character vectors
## refernces - character vector

## This takes a list of astEntries and processes them
processExpressionList <- function(varInfo,astEntryList) {
  for(i in 1:length(astEntryList)) {
    varInfo <- processExpression(varInfo,astEntryList[[i]])
  }
  
  varInfo
}

## This process an astEntry, updating the stack and the references
processExpression <- function(varInfo,astEntry) {
  if(is_syntactic_literal(astEntry)) {
    ##no action
    varInfo
  }
  else if(is_symbol(astEntry)) {
    varInfo <- processSymbol(varInfo,astEntry)
  }
  else if(is_call(astEntry)) {
    varInfo <- processCall(varInfo,astEntry)
  }
  else if(is_pairlist(astEntry)) {
    stop("pairlist not supported outside function definition!")
  }
  else {
    ##no action 
    varInfo
  }
}

## This process a symbol entry. It adds the name to
## external references is it is not in the stack
processSymbol <- function(varInfo,astEntry) {
  name <- as.character(astEntry)
  if(!isInStack(varInfo,name)) {
    varInfo <- addToReferences(varInfo,name)
  }
  varInfo
}

processPairlist <- function(varinfo,astEntry) {
  ## add this?
  stop("Pairlist not supported outside function definition!")
}

## This function process a "call" entry 
processCall <- function(varInfo,astEntry) {
  astList <- as.list(astEntry)
  funSymbol <- as.character(astList[[1]])
  
  if(is_call(astEntry,"function")) {
    varInfo <- processCallFunction(varInfo,astList)
  }
  else if(is_call(astEntry,"<-")||is_call(astEntry,"=")) {
    varInfo <- processCallAssign(varInfo,astList)
  }
  else if(is_call(astEntry,"<<-")) {
    varInfo <- processCallSuperAssign(varInfo,astList)
  }
  else if(is_call(astEntry,"$")) {
    ##this one has a literal that takes the form of a symbol
    varInfo <- processDollarSign(varInfo,astList)
  }
  else {
    ##other cases, process all including function name
    varInfo <- processExpressionList(varInfo,astList)
  }
  
  varInfo
}

## This function process a "call" entry to the "function" function
processCallFunction <- function(varInfo,astList) {
  ## add a new frame to the end of the stack
  varInfo$stack[[length(varInfo$stack)+1]] <- character()
  
  ## if entry #2 is a pairlist, add all those to the local frame
  if( (length(astList) >= 2) && (is_pairlist(astList[[2]])) ) {
    varInfo <- addPairlistToLocals(varInfo,astList[[2]])
    startRemaining <- 3
  }
  else {
    startRemaining <- 2
  }
  
  ## process the body of the function
  varInfo <- processExpression(varInfo,astList[[3]])
  
  ##remove this frame from the stack
  varInfo$stack <- head(varInfo$stack,-1)
  
  varInfo
}

## This function process a "call" entry to the "<-" (or "->") or "=" function
processCallAssign <- function(varInfo,astList) {
  assigneeEntry <- astList[[2]]
  
  if(is_symbol(assigneeEntry)) {
    name <- as.character(assigneeEntry)
    varInfo <- addToLocals(varInfo,name)
  }
  else if(is_call(assigneeEntry)) {
    stop("CURRENTLY ONLY SIMPLE LEFT HAND SIDE OF ASSIGN SUPPORTED!")
    
    ## We handle two cases of assignment here
    ## replacement functions - first arg is assigned to (created locally if needed)
    ## subsetting functions - first argument is assigned to (created locally if needed)
    ## NOTE - name problem with replacement functions!!!
    #varInfo <- processLhsCall(varInfo,asigneeEntry)
  }
  
  ## process any additional elements normally
  if(length(astList) != 3) {
    ##I don't expect this. I'll check
    stop("Unexpected length in assign function")
  }
  varInfo <- processExpression(varInfo,astList[[3]])
  
  varInfo
}

#processLhsCall <- function(varInfo,astEntry) {
#  astList <- as.list(astEntry)
#  funSymbol <- as.character(astList[[1]])
#  assigneeEntry <- astlist[[2]]
#  
#  if(is_call(astEntry,"[[")||is_call(astEntry,"[")) {
#    
#  }
#  else if(is_call(astEntry,"$")) {
#    ##this one has a literal that takes the form of a symbol
#    varInfo <- processDollarSign(varInfo,astList)
#  }
#  else {
#    ## this should be a replacement function - add <- to name
#    ## DOH! make sure arrow is not already there!
#    funSymbol <- paste(funSymbol,"<-",sep="")
#  }
#  
#  varInfo
#}

## This function process a "call" entry to the "<<-" (or "->>") function
processCallSuperAssign <- function(varInfo,astList) {
  assigneeEntry <- astList[[2]]
  
  if(is_symbol(assigneeEntry)) {
    name <- as.character(assigneeEntry)
    ## throw an error if the name is not in the stack
    ## this means an external value will be modified
    if(!isInStack(varInfo,name)) {
      stop("Not supporting `<<-` to set non-local variables!")
    }
  }
  else {
    stop("CURRENTLY ONLY SIMPLE LEFT HAND SIDE OF ASSIGN SUPPORTED!")
  }
  
  ## process any additional elements normally
  if(length(astList) != 3) {
    ##I don't expect this. I'll check
    stop("Unexpected length in assign function")
  }
  varInfo <- processExpression(varInfo,astList[[3]])
  
  varInfo
}

processDollarSign <- function(varInfo,astList) {
  if(length(astList) != 3) {
    stop("UNknown error - unexpected length of $ arg list")
  }
  if(!is_symbol(astList[[3]])) {
    stop("Unexpected token after $ operator")
  }
  ##Only process the first argument of $. Second arg should be a symbol
  ##but it is really a literal
  varInfo <- processExpression(varInfo,astList[[2]])
}

##=========================
## Utilities
##=========================


## This checks if a single name is in the stack
isInStack <- function(varInfo,name) {
  name %in% unlist(varInfo)
}

## This added one or more names to the refernces
addToReferences <- function(varInfo,nms) {
  nmsToAdd <- nms[!(nms %in% varInfo$references)]
  varInfo$references <- c(varInfo$references,nmsToAdd)
  
  varInfo
}

## This adds one or more names to the local variables
addToLocals <- function(varInfo,nms) {
  stackLength <- length(varInfo$stack)
  topFrame <- varInfo$stack[[stackLength]]
  nmsToAdd <- nms[!(nms %in% topFrame)]
  
  varInfo$stack[[stackLength]] <- c(topFrame,nmsToAdd)
  
  varInfo
}


## This adds all entries from the pair list (except ...)
## to the local stack frame
addPairlistToLocals <- function(varInfo,astEntry) {
  nms <- names(astEntry)
  nms <- nms[nms != "..."]
  
  varInfo <- addToLocals(varInfo,nms)
}


##########################################################
## TEST
##########################################################

runTest <- function() {
  argList <- c("x")
  codeText <- '
    dat <- rnorm(x)
    z <- y * mean(dat)
    z <- z + alpha$ert
    ert <- 3
    foo <- function(u) {
      x <- u + 45
      x + beta
    }
    foo(z)
  '
  
  codeInfo <- compileCode(argList,codeText)
  print(codeInfo)
}

