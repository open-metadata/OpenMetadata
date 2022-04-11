# Generated from /Users/amiorin/code/OpenMetadata/catalog-rest-service/src/main/antlr4/org/openmetadata/catalog/Fqn.g4 by ANTLR 4.9.3
import sys
from io import StringIO

from antlr4 import *

if sys.version_info[1] > 5:
    from typing import TextIO
else:
    from typing.io import TextIO


def serializedATN():
    with StringIO() as buf:
        buf.write("\3\u608b\ua72a\u8133\ub9ed\u417c\u3be7\u7786\u5964\2\b")
        buf.write("\63\b\1\4\2\t\2\4\3\t\3\4\4\t\4\4\5\t\5\4\6\t\6\4\7\t")
        buf.write("\7\3\2\3\2\3\3\6\3\23\n\3\r\3\16\3\24\3\4\3\4\7\4\31\n")
        buf.write("\4\f\4\16\4\34\13\4\3\4\3\4\7\4 \n\4\f\4\16\4#\13\4\6")
        buf.write("\4%\n\4\r\4\16\4&\3\4\3\4\3\5\3\5\3\6\3\6\3\7\3\7\3\7")
        buf.write("\5\7\62\n\7\2\2\b\3\3\5\4\7\5\t\6\13\7\r\b\3\2\3\4\2$")
        buf.write("$\60\60\2\67\2\3\3\2\2\2\2\5\3\2\2\2\2\7\3\2\2\2\2\t\3")
        buf.write("\2\2\2\2\13\3\2\2\2\2\r\3\2\2\2\3\17\3\2\2\2\5\22\3\2")
        buf.write("\2\2\7\26\3\2\2\2\t*\3\2\2\2\13,\3\2\2\2\r\61\3\2\2\2")
        buf.write("\17\20\7\60\2\2\20\4\3\2\2\2\21\23\5\13\6\2\22\21\3\2")
        buf.write("\2\2\23\24\3\2\2\2\24\22\3\2\2\2\24\25\3\2\2\2\25\6\3")
        buf.write("\2\2\2\26\32\5\t\5\2\27\31\5\13\6\2\30\27\3\2\2\2\31\34")
        buf.write("\3\2\2\2\32\30\3\2\2\2\32\33\3\2\2\2\33$\3\2\2\2\34\32")
        buf.write("\3\2\2\2\35!\5\r\7\2\36 \5\13\6\2\37\36\3\2\2\2 #\3\2")
        buf.write('\2\2!\37\3\2\2\2!"\3\2\2\2"%\3\2\2\2#!\3\2\2\2$\35\3')
        buf.write("\2\2\2%&\3\2\2\2&$\3\2\2\2&'\3\2\2\2'(\3\2\2\2()\5\t")
        buf.write("\5\2)\b\3\2\2\2*+\7$\2\2+\n\3\2\2\2,-\n\2\2\2-\f\3\2\2")
        buf.write("\2.\62\7\60\2\2/\60\7$\2\2\60\62\7$\2\2\61.\3\2\2\2\61")
        buf.write("/\3\2\2\2\62\16\3\2\2\2\b\2\24\32!&\61\2")
        return buf.getvalue()


class FqnLexer(Lexer):

    atn = ATNDeserializer().deserialize(serializedATN())

    decisionsToDFA = [DFA(ds, i) for i, ds in enumerate(atn.decisionToState)]

    T__0 = 1
    NAME = 2
    NAME_WITH_RESERVED = 3
    QUOTE = 4
    NON_RESERVED = 5
    RESERVED = 6

    channelNames = [u"DEFAULT_TOKEN_CHANNEL", u"HIDDEN"]

    modeNames = ["DEFAULT_MODE"]

    literalNames = ["<INVALID>", "'.'", "'\"'"]

    symbolicNames = [
        "<INVALID>",
        "NAME",
        "NAME_WITH_RESERVED",
        "QUOTE",
        "NON_RESERVED",
        "RESERVED",
    ]

    ruleNames = [
        "T__0",
        "NAME",
        "NAME_WITH_RESERVED",
        "QUOTE",
        "NON_RESERVED",
        "RESERVED",
    ]

    grammarFileName = "Fqn.g4"

    def __init__(self, input=None, output: TextIO = sys.stdout):
        super().__init__(input, output)
        self.checkVersion("4.9.3")
        self._interp = LexerATNSimulator(
            self, self.atn, self.decisionsToDFA, PredictionContextCache()
        )
        self._actions = None
        self._predicates = None
