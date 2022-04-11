from metadata.antlr.FqnListener import FqnListener
from metadata.antlr.FqnParser import FqnParser


class SplitListener(FqnListener):
    xs = []

    def __init__(self):
        pass

    def enterQuotedName(self, ctx: FqnParser.QuotedNameContext):
        self.xs.append(ctx.getText())

    def enterUnquotedName(self, ctx: FqnParser.UnquotedNameContext):
        self.xs.append(ctx.getText())

    def split(self):
        return self.xs

