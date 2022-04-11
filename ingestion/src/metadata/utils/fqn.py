from typing import List

from antlr4 import *

from metadata.antlr.FqnLexer import FqnLexer
from metadata.antlr.FqnParser import FqnParser
from metadata.antlr.SplitListener import SplitListener
from metadata.config.common import FQDN_SEPARATOR


def split(s: str) -> List[str]:
    """Equivalent of Java's FulliQualifiedName#split"""
    lexer = FqnLexer(InputStream(s))
    stream = CommonTokenStream(lexer)
    parser = FqnParser(stream)
    tree = parser.fqn()
    walker = ParseTreeWalker()
    splitter = SplitListener()
    walker.walk(splitter, tree)
    return splitter.split()


def build(*args):
    """Equivalent of Java's FulliQualifiedName#build"""
    result = []
    for name in args:
        result.append(name)
    return FQDN_SEPARATOR.join(result)
