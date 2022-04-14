from metadata.generated.antlr.FqnListener import FqnListener
from metadata.generated.antlr.FqnParser import FqnParser


class SplitListener(FqnListener):
    def __init__(self):
        self.xs = []

    def enterQuotedName(self, ctx: FqnParser.QuotedNameContext):
        self.xs.append(ctx.getText())

    def enterUnquotedName(self, ctx: FqnParser.UnquotedNameContext):
        self.xs.append(ctx.getText())

    def split(self):
        return self.xs
