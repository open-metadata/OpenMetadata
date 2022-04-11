from antlr4 import *

from metadata.antlr.FqnLexer import FqnLexer
from metadata.antlr.FqnParser import FqnParser
from metadata.antlr.SplitListener import SplitListener


def main():
  lexer = FqnLexer(InputStream("""foo.bar"""))
  stream = CommonTokenStream(lexer)
  parser = FqnParser(stream)
  tree = parser.fqn()
  walker = ParseTreeWalker()
  splitter = SplitListener()
  walker.walk(splitter, tree)
  print(splitter.split())


if __name__ == '__main__':
  main()
