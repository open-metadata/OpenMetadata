grammar OpenMetadataDSL;

// Main entry point
expression
    : assignmentExpression
    | conditionalExpression
    | logicalOrExpression
    ;

// Variable assignment
assignmentExpression
    : 'LET' IDENTIFIER '=' expression
    ;

// Conditional expressions
conditionalExpression
    : 'IF' expression 'THEN' expression ('ELSE' expression)?
    ;

// Logical expressions
logicalOrExpression
    : logicalAndExpression (OR logicalAndExpression)*
    ;

logicalAndExpression
    : equalityExpression (AND equalityExpression)*
    ;

equalityExpression
    : comparisonExpression ((EQUALS | NOT_EQUALS) comparisonExpression)*
    ;

comparisonExpression
    : additiveExpression ((GREATER | GREATER_EQUALS | LESS | LESS_EQUALS) additiveExpression)*
    | additiveExpression IN '(' expressionList ')'
    | additiveExpression NOT IN '(' expressionList ')'
    ;

additiveExpression
    : multiplicativeExpression ((PLUS | MINUS) multiplicativeExpression)*
    ;

multiplicativeExpression
    : unaryExpression ((MULTIPLY | DIVIDE) unaryExpression)*
    ;

unaryExpression
    : (NOT | MINUS | PLUS)? primaryExpression
    ;

primaryExpression
    : fieldAccess
    | functionCall
    | literal
    | '(' expression ')'
    ;

// Field access with dot notation and array indexing
fieldAccess
    : IDENTIFIER ('.' IDENTIFIER | '[' expression ']')*
    ;

// Function calls
functionCall
    : IDENTIFIER '(' expressionList? ')'
    ;

// Expression list for function arguments
expressionList
    : expression (',' expression)*
    ;

// Literals
literal
    : STRING_LITERAL
    | NUMBER_LITERAL
    | BOOLEAN_LITERAL
    | NULL_LITERAL
    ;

// Tokens
// Operators
EQUALS          : '==' ;
NOT_EQUALS      : '!=' ;
GREATER         : '>' ;
GREATER_EQUALS  : '>=' ;
LESS            : '<' ;
LESS_EQUALS     : '<=' ;
PLUS            : '+' ;
MINUS           : '-' ;
MULTIPLY        : '*' ;
DIVIDE          : '/' ;

// Logical operators
AND             : 'AND' ;
OR              : 'OR' ;
NOT             : 'NOT' ;
IN              : 'IN' ;

// Literals
BOOLEAN_LITERAL : 'true' | 'false' ;
NULL_LITERAL    : 'null' ;

// Numbers (integers and decimals)
NUMBER_LITERAL  : [0-9]+ ('.' [0-9]+)? ;

// Strings (single or double quoted)
STRING_LITERAL  : '\'' (~['\r\n] | '\\' .)* '\''
                | '"' (~["\r\n] | '\\' .)* '"'
                ;

// Identifiers
IDENTIFIER      : [a-zA-Z_][a-zA-Z0-9_]* ;

// Whitespace
WS              : [ \t\r\n]+ -> skip ;

// Comments (optional for future use)
LINE_COMMENT    : '//' ~[\r\n]* -> skip ;
BLOCK_COMMENT   : '/*' .*? '*/' -> skip ;