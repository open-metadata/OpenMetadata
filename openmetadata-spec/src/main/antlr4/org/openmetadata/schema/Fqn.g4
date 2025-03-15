grammar Fqn;

fqn
    : name ('.' name)* EOF
    ;

// A name component of an FQN.
// - unquotedName: regular name without dots (can contain " quotes)
// - quotedName: name with dots, enclosed in quotes
name
    : NAME               # unquotedName
    | NAME_WITH_RESERVED # quotedName
    ;

NAME
    : (NON_RESERVED | QUOTE)+
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