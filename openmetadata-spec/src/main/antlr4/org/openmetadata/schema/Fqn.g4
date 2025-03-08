grammar Fqn;

fqn
    : name ('.' name)* EOF
    ;

name
    : NAME                        # unquotedName
    | NAME_WITH_RESERVED          # quotedName
    | SIMPLE_QUOTED_NAME          # simpleQuotedName
    ;

NAME
    : NON_RESERVED+
    ;

NAME_WITH_RESERVED
    : QUOTE NON_RESERVED* (RESERVED NON_RESERVED*)+ QUOTE
    ;

SIMPLE_QUOTED_NAME
    : (NON_RESERVED | ESCAPED_QUOTE)*
    ;
fragment ESCAPED_QUOTE
    : '\\' '"'
    ;

QUOTE
    : '"'
    ;

NON_RESERVED
    : ~[".\\]
    ;

RESERVED
    : '.'
    ;