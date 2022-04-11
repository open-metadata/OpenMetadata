import re
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


def build(*args: List[str]) -> str:
    """Equivalent of Java's FulliQualifiedName#build"""
    result = []
    for name in args:
        result.append(quote_name(name))
    return FQDN_SEPARATOR.join(result)


def unquote_name(name: str) -> str:
    tmp_name = re.sub(r'^"|"$', "", name)
    return re.sub(r'""', '"', tmp_name)


def quote_name(name: str) -> str:
    if bool(re.search(r'[.|"]', name)):
        return '"' + re.sub(r'"', '""', name) + '"'
    else:
        return name
