# Me #1
I'd like an R function that takes a fragment of R code as a string and finds the external variables it references (uses) and the variables it modifies/creates.

For created/modified variables, I would like to know which used a normal assign operator (`->`, `<-`, `=`) and which used a super assign operator (`<<-`, `->>`) sincs this impacts where that variable will come from. Additionally, I want to know which accessed variables are functions that are called, since this also impacts how that variable will be selected. You can determine a data structure to return this information.

There is an R function that finds dependencies, "codetools::findGlobals", but it falls short of what I need.

I will give some input. Presumably "rlang::parseexpr" and/or "rlang::parseexrps" will be used to split the expression into literals, symbols, calls, pairlists and possibly more. The symbols represent variable names in most cases. I can list a few examples where symbols represent other things:

- `$` - The first argument is a variable and the second is not, it is an element of the variable given by the first argument.
- `::` and `:::` - Here the first argument is a package name and the second is a member of the package, so neither is a variable.
- `@` - I think the second argument is a member of the class? I think the first is a variable but I'm not sure.
- function call - in the argument list, names can be passed in (for example, foo(a=4,6,...) ). These refer to parameter names and not variables.

The above is probably not an exhaustive list, but it is certainly some of the cases.

///////////////////////////////////////////////////////////////////////////////////////////////////////////

# ChatGPT 4 #1

In R, parsing the code and determining the variables can be complicated, but it's possible with some nested function calls and recursion. To start, let's define a helper function to determine if the code uses an assignment operator:

```R
is_assignment <- function(expr) {
  if (is.call(expr)) {
    if (length(expr) >= 2) {
      op <- as.character(expr[[1]])
      return (op %in% c("<-", "=", "<<-", "->", "->>"))
    }
  }
  return(FALSE)
}
```

We also need a function to check if a function call is made:

```R
is_function_call <- function(expr) {
  if (is.call(expr)) {
    op <- as.character(expr[[1]])
    return (op == "")
  }
  return(FALSE)
}
```

Now we can define a recursive function to traverse the parsed expression:

```R
traverse_expr <- function(expr, vars=list(used=list(), assigned=list(), super_assigned=list(), function_calls=list())) {
  if (is.symbol(expr)) {
    vars$used <- c(vars$used, as.character(expr))
  }
  else if (is.call(expr)) {
    if (is_assignment(expr)) {
      op <- as.character(expr[[1]])
      if (op %in% c("<-", "=")) {
        vars$assigned <- c(vars$assigned, as.character(expr[[2]]))
      } else {
        vars$super_assigned <- c(vars$super_assigned, as.character(expr[[2]]))
      }
      vars <- traverse_expr(expr[[3]], vars)
    }
    else if (is_function_call(expr)) {
      vars$function_calls <- c(vars$function_calls, as.character(expr[[2]]))
      if (length(expr) > 2) {
        for (i in 3:length(expr)) {
          vars <- traverse_expr(expr[[i]], vars)
        }
      }
    }
    else if (length(expr) > 1) {
      for (i in 2:length(expr)) {
        vars <- traverse_expr(expr[[i]], vars)
      }
    }
  }
  return(vars)
}
```

Finally, we can write the main function to parse the code and analyze the variables:

```R
analyze_code <- function(code) {
  parsed <- rlang::parse_expr(code)
  vars <- traverse_expr(parsed)
  return(vars)
}
```

The `analyze_code` function returns a list with four elements:

- `used`: Variables that are used in the code.
- `assigned`: Variables that are assigned a value using the `<-` or `=` operators.
- `super_assigned`: Variables that are assigned a value using the `<<-` or `->>` operators.
- `function_calls`: Functions that are called in the code.

Please note, the `traverse_expr` function assumes all function calls and assignments have two arguments, which is usually the case, but there might be some exceptions. It also doesn't handle special cases like `$`, `::`, `:::`, and `@`, so you would need to modify the function if you want to handle these cases.

This function might not catch all edge cases and it might not be perfect but it gives you a place to start and you can modify it as per your needs.

////////////////////////////////////////////////////////////////////////////

# Me #2

I may have been unclear on some of the specifications. The sample below hopefully helps illustrate what I am looking for. I ran this example on the code from above and then I give some of the changes I want.

```
> codeText = "foo <- function(x=3,...) { z <- rnorm(x*y); mean(z) }"
> analyze_code(codeText)
$used
$used[[1]]
[1] "x"

$used[[2]]
[1] "y"

$used[[3]]
[1] "z"


$assigned
$assigned[[1]]
[1] "foo"

$assigned[[2]]
[1] "z"


$super_assigned
list()

$function_calls
list()
````

Problems:

I want the external variables that are used and the outputs created. In the code above, one is variable created "foo" and three variables are used: "y", "rnorm" and "mean". Two variables "x" and "z" appear in the function scope and are not external variables.

Some notes:

- One major change needed is to track local variables when we are in a function definition, perhaps through the use of a stack for tracking local variables.
- I think the function is_function_call might have a problem, or I might just not understand. It appears it only returns true if the function being called has the name empty string. Perhaps I don't understand what it is doing. 
- As a preference, let's use the rlang package for things like rlang::is_call rather than the base function "is.call". Also, since I will use this in a package, use the package name prefix for any case where a library would need to be loaded, like for "rlang"
