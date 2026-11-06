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

// A quoted name may contain any character, including the reserved '.' separator
// and the '"' quote itself, which is escaped by doubling it ("").
// At least one character is required: empty quoted segments ("") are not valid FQN segments.
NAME_WITH_RESERVED
    : QUOTE ( ~["] | '""' )+ QUOTE
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