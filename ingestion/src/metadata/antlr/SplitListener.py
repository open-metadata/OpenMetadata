from metadata.antlr.FqnListener import FqnListener
from metadata.antlr.FqnParser import FqnParser


class SplitListener(FqnListener):
    def __init__(self):
        self.xs = []

    def enterQuotedName(self, ctx: FqnParser.QuotedNameContext):
        # to avoid circular import
        from metadata.utils.fqn import unquote_name
        self.xs.append(unquote_name(ctx.getText()))

    def enterUnquotedName(self, ctx: FqnParser.UnquotedNameContext):
        self.xs.append(ctx.getText())

    def split(self):
        return self.xs

