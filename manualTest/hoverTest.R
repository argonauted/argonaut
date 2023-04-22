## NEEDS WORK!!!
## Hover Testing
## Assign Test
x <- 10
y <- x + 1
z = y + 1
a <<- z + 1
a + 1 -> b
b + 1 ->> d
d <- d + 1
## OOF! The above equation did not update properly in certain cases

## binary
e <- a + b

## unary
a <- -b

lst <- list(a=1,b=2)
letter <- "a"

##subset
lst[letter]
lst[[letter]]

## dollar expr
lst$a
## Dollar RGS nover not implmented

##function call
xxx <- 1:9
mean(x=xxx)
mean(xxx)


{
  lst
}
## list hover didn't work, but I think that is OK? investigate?

## paren
(lst)

##if then
if(x == 10) y else z

##top level ident
lst


