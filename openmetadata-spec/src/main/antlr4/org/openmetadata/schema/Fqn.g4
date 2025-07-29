grammar Fqn;

// ---- PARSER RULES ----
// These parser rules are identical to your original grammar.

fqn
    : name ('.' name)* EOF
    ;

name
    : NAME                   # unquotedName
    | NAME_WITH_RESERVED     # quotedName
    ;

// ---- LEXER RULES ----

/**
 * NAME token (redefined from original):
 * For unquoted name segments.
 * Allows most characters including spaces and hyphens.
 * Disallows literal dots (.), unescaped quotes ("), and unescaped backslashes (\).
 * Requires quotes and backslashes within the segment to be escaped (e.g., \" or \\).
 */
NAME
    : ( EscapedChar | PlainUnquotedNameChar )+
    ;

/**
 * NAME_WITH_RESERVED token (redefined from original):
 * For name segments that are fully enclosed in double quotes.
 * The requirement for an internal dot (original 'RESERVED') is REMOVED.
 * Allows any characters inside the quotes, including dots and spaces.
 * Internal quotes (") and backslashes (\) must be escaped.
 */
NAME_WITH_RESERVED
    : '"' ( EscapedChar | PlainQuotedNameChar )* '"'
    ;

// ---- FRAGMENTS ----
// These fragments support the new definitions of NAME and NAME_WITH_RESERVED.
// The original NON_RESERVED and RESERVED fragment logic is superseded by these more specific fragments.

/**
 * Defines allowed escape sequences.
 * For this grammar, only a double quote (\") and a backslash (\\) can be escaped.
 */
fragment EscapedChar
    : '\\' ( '"' | '\\' ) // Matches \" or \\
    ;

/**
 * Defines characters allowed in an unquoted NAME segment that are not part of an escape sequence.
 * Matches any single character that is NOT a dot (.), a double quote ("), or a backslash (\).
 */
fragment PlainUnquotedNameChar
    : ~[.'"\\]
    ;

/**
 * Defines characters allowed inside a quoted NAME_WITH_RESERVED segment
 * that are not part of an escape sequence.
 * Matches any single character that is NOT a double quote (") or a backslash (\).
 * Dots and spaces are allowed here.
 */
fragment PlainQuotedNameChar
    : ~["\\]
    ;