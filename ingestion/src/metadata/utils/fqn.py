import re
from typing import List

from antlr4 import *

from metadata.antlr.SplitListener import SplitListener
from metadata.config.common import FQDN_SEPARATOR
from metadata.generated.antlr.FqnLexer import FqnLexer
from metadata.generated.antlr.FqnParser import FqnParser


def split(s: str) -> List[str]:
    """Equivalent of Java's FullyQualifiedName#split"""
    lexer = FqnLexer(InputStream(s))
    stream = CommonTokenStream(lexer)
    parser = FqnParser(stream)
    parser._errHandler = BailErrorStrategy()
    tree = parser.fqn()
    walker = ParseTreeWalker()
    splitter = SplitListener()
    walker.walk(splitter, tree)
    return splitter.split()


def build(*args: List[str]) -> str:
    """Equivalent of Java's FullyQualifiedName#build"""
    result = []
    for name in args:
        result.append(quote_name(name))
    return FQDN_SEPARATOR.join(result)


def quote_name(name: str) -> str:
    """Equivalent of Java's FullyQualifiedName#quoteName"""
    matcher = re.compile(r'^(")([^"]+)(")$|^(.*)$').match(name)
    if not matcher or len(matcher.group(0)) != len(name):
        raise ValueError("Invalid name " + name)

    # Name matches quoted string "sss".
    # If quoted string does not contain "." return unquoted sss, else return quoted "sss"
    if matcher.group(1):
        unquoted_name = matcher.group(2)
        return name if "." in unquoted_name else unquoted_name

    # Name matches unquoted string sss
    # If unquoted string contains ".", return quoted "sss", else unquoted sss
    unquoted_name = matcher.group(4)
    if '"' not in unquoted_name:
        return '"' + name + '"' if "." in unquoted_name else unquoted_name
    raise ValueError("Invalid name " + name)
