# Generated from /Users/amiorin/code/OpenMetadata/catalog-rest-service/src/main/antlr4/org/openmetadata/catalog/Fqn.g4 by ANTLR 4.9.3
# encoding: utf-8
from antlr4 import *
from io import StringIO
import sys
if sys.version_info[1] > 5:
	from typing import TextIO
else:
	from typing.io import TextIO


def serializedATN():
    with StringIO() as buf:
        buf.write("\3\u608b\ua72a\u8133\ub9ed\u417c\u3be7\u7786\u5964\3\b")
        buf.write("\25\4\2\t\2\4\3\t\3\3\2\3\2\3\2\7\2\n\n\2\f\2\16\2\r\13")
        buf.write("\2\3\2\3\2\3\3\3\3\5\3\23\n\3\3\3\2\2\4\2\4\2\2\2\24\2")
        buf.write("\6\3\2\2\2\4\22\3\2\2\2\6\13\5\4\3\2\7\b\7\3\2\2\b\n\5")
        buf.write("\4\3\2\t\7\3\2\2\2\n\r\3\2\2\2\13\t\3\2\2\2\13\f\3\2\2")
        buf.write("\2\f\16\3\2\2\2\r\13\3\2\2\2\16\17\7\2\2\3\17\3\3\2\2")
        buf.write("\2\20\23\7\4\2\2\21\23\7\5\2\2\22\20\3\2\2\2\22\21\3\2")
        buf.write("\2\2\23\5\3\2\2\2\4\13\22")
        return buf.getvalue()


class FqnParser ( Parser ):

    grammarFileName = "Fqn.g4"

    atn = ATNDeserializer().deserialize(serializedATN())

    decisionsToDFA = [ DFA(ds, i) for i, ds in enumerate(atn.decisionToState) ]

    sharedContextCache = PredictionContextCache()

    literalNames = [ "<INVALID>", "'.'", "<INVALID>", "<INVALID>", "'\"'" ]

    symbolicNames = [ "<INVALID>", "<INVALID>", "NAME", "NAME_WITH_RESERVED", 
                      "QUOTE", "NON_RESERVED", "RESERVED" ]

    RULE_fqn = 0
    RULE_name = 1

    ruleNames =  [ "fqn", "name" ]

    EOF = Token.EOF
    T__0=1
    NAME=2
    NAME_WITH_RESERVED=3
    QUOTE=4
    NON_RESERVED=5
    RESERVED=6

    def __init__(self, input:TokenStream, output:TextIO = sys.stdout):
        super().__init__(input, output)
        self.checkVersion("4.9.3")
        self._interp = ParserATNSimulator(self, self.atn, self.decisionsToDFA, self.sharedContextCache)
        self._predicates = None




    class FqnContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def name(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(FqnParser.NameContext)
            else:
                return self.getTypedRuleContext(FqnParser.NameContext,i)


        def EOF(self):
            return self.getToken(FqnParser.EOF, 0)

        def getRuleIndex(self):
            return FqnParser.RULE_fqn

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterFqn" ):
                listener.enterFqn(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitFqn" ):
                listener.exitFqn(self)




    def fqn(self):

        localctx = FqnParser.FqnContext(self, self._ctx, self.state)
        self.enterRule(localctx, 0, self.RULE_fqn)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 4
            self.name()
            self.state = 9
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            while _la==FqnParser.T__0:
                self.state = 5
                self.match(FqnParser.T__0)
                self.state = 6
                self.name()
                self.state = 11
                self._errHandler.sync(self)
                _la = self._input.LA(1)

            self.state = 12
            self.match(FqnParser.EOF)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class NameContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser


        def getRuleIndex(self):
            return FqnParser.RULE_name

     
        def copyFrom(self, ctx:ParserRuleContext):
            super().copyFrom(ctx)



    class QuotedNameContext(NameContext):

        def __init__(self, parser, ctx:ParserRuleContext): # actually a FqnParser.NameContext
            super().__init__(parser)
            self.copyFrom(ctx)

        def NAME_WITH_RESERVED(self):
            return self.getToken(FqnParser.NAME_WITH_RESERVED, 0)

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterQuotedName" ):
                listener.enterQuotedName(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitQuotedName" ):
                listener.exitQuotedName(self)


    class UnquotedNameContext(NameContext):

        def __init__(self, parser, ctx:ParserRuleContext): # actually a FqnParser.NameContext
            super().__init__(parser)
            self.copyFrom(ctx)

        def NAME(self):
            return self.getToken(FqnParser.NAME, 0)

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterUnquotedName" ):
                listener.enterUnquotedName(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitUnquotedName" ):
                listener.exitUnquotedName(self)



    def name(self):

        localctx = FqnParser.NameContext(self, self._ctx, self.state)
        self.enterRule(localctx, 2, self.RULE_name)
        try:
            self.state = 16
            self._errHandler.sync(self)
            token = self._input.LA(1)
            if token in [FqnParser.NAME]:
                localctx = FqnParser.UnquotedNameContext(self, localctx)
                self.enterOuterAlt(localctx, 1)
                self.state = 14
                self.match(FqnParser.NAME)
                pass
            elif token in [FqnParser.NAME_WITH_RESERVED]:
                localctx = FqnParser.QuotedNameContext(self, localctx)
                self.enterOuterAlt(localctx, 2)
                self.state = 15
                self.match(FqnParser.NAME_WITH_RESERVED)
                pass
            else:
                raise NoViableAltException(self)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx





