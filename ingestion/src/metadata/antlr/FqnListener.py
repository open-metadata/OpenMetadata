# Generated from /Users/amiorin/code/OpenMetadata/catalog-rest-service/src/main/antlr4/org/openmetadata/catalog/Fqn.g4 by ANTLR 4.9.3
from antlr4 import *
if __name__ is not None and "." in __name__:
    from .FqnParser import FqnParser
else:
    from FqnParser import FqnParser

# This class defines a complete listener for a parse tree produced by FqnParser.
class FqnListener(ParseTreeListener):

    # Enter a parse tree produced by FqnParser#fqn.
    def enterFqn(self, ctx:FqnParser.FqnContext):
        pass

    # Exit a parse tree produced by FqnParser#fqn.
    def exitFqn(self, ctx:FqnParser.FqnContext):
        pass


    # Enter a parse tree produced by FqnParser#unquotedName.
    def enterUnquotedName(self, ctx:FqnParser.UnquotedNameContext):
        pass

    # Exit a parse tree produced by FqnParser#unquotedName.
    def exitUnquotedName(self, ctx:FqnParser.UnquotedNameContext):
        pass


    # Enter a parse tree produced by FqnParser#quotedName.
    def enterQuotedName(self, ctx:FqnParser.QuotedNameContext):
        pass

    # Exit a parse tree produced by FqnParser#quotedName.
    def exitQuotedName(self, ctx:FqnParser.QuotedNameContext):
        pass



del FqnParser