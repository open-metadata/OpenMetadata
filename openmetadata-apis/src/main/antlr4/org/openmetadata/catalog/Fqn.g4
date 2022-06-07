grammar Fqn;

fqn
    : name ('.' name)* EOF
    ;

name
    : NAME               # unquotedName
    | NAME_WITH_RESERVED # quotedName
    ;

NAME
    : NON_RESERVED+
    ;

NAME_WITH_RESERVED
    : QUOTE NON_RESERVED* (RESERVED NON_RESERVED*)+ QUOTE
    ;

QUOTE
    : '"'
    ;

NON_RESERVED
    : ~[".]
    ;

RESERVED
    : '.'
    ;