// Generated from /Users/amiorin/code/OpenMetadata/catalog-rest-service/src/main/antlr4/org/openmetadata/catalog/Fqn.g4 by ANTLR 4.9.3
// jshint ignore: start
import antlr4 from 'antlr4';



const serializedATN = ["\u0003\u608b\ua72a\u8133\ub9ed\u417c\u3be7\u7786",
    "\u5964\u0002\b3\b\u0001\u0004\u0002\t\u0002\u0004\u0003\t\u0003\u0004",
    "\u0004\t\u0004\u0004\u0005\t\u0005\u0004\u0006\t\u0006\u0004\u0007\t",
    "\u0007\u0003\u0002\u0003\u0002\u0003\u0003\u0006\u0003\u0013\n\u0003",
    "\r\u0003\u000e\u0003\u0014\u0003\u0004\u0003\u0004\u0007\u0004\u0019",
    "\n\u0004\f\u0004\u000e\u0004\u001c\u000b\u0004\u0003\u0004\u0003\u0004",
    "\u0007\u0004 \n\u0004\f\u0004\u000e\u0004#\u000b\u0004\u0006\u0004%",
    "\n\u0004\r\u0004\u000e\u0004&\u0003\u0004\u0003\u0004\u0003\u0005\u0003",
    "\u0005\u0003\u0006\u0003\u0006\u0003\u0007\u0003\u0007\u0003\u0007\u0005",
    "\u00072\n\u0007\u0002\u0002\b\u0003\u0003\u0005\u0004\u0007\u0005\t",
    "\u0006\u000b\u0007\r\b\u0003\u0002\u0003\u0004\u0002$$00\u00027\u0002",
    "\u0003\u0003\u0002\u0002\u0002\u0002\u0005\u0003\u0002\u0002\u0002\u0002",
    "\u0007\u0003\u0002\u0002\u0002\u0002\t\u0003\u0002\u0002\u0002\u0002",
    "\u000b\u0003\u0002\u0002\u0002\u0002\r\u0003\u0002\u0002\u0002\u0003",
    "\u000f\u0003\u0002\u0002\u0002\u0005\u0012\u0003\u0002\u0002\u0002\u0007",
    "\u0016\u0003\u0002\u0002\u0002\t*\u0003\u0002\u0002\u0002\u000b,\u0003",
    "\u0002\u0002\u0002\r1\u0003\u0002\u0002\u0002\u000f\u0010\u00070\u0002",
    "\u0002\u0010\u0004\u0003\u0002\u0002\u0002\u0011\u0013\u0005\u000b\u0006",
    "\u0002\u0012\u0011\u0003\u0002\u0002\u0002\u0013\u0014\u0003\u0002\u0002",
    "\u0002\u0014\u0012\u0003\u0002\u0002\u0002\u0014\u0015\u0003\u0002\u0002",
    "\u0002\u0015\u0006\u0003\u0002\u0002\u0002\u0016\u001a\u0005\t\u0005",
    "\u0002\u0017\u0019\u0005\u000b\u0006\u0002\u0018\u0017\u0003\u0002\u0002",
    "\u0002\u0019\u001c\u0003\u0002\u0002\u0002\u001a\u0018\u0003\u0002\u0002",
    "\u0002\u001a\u001b\u0003\u0002\u0002\u0002\u001b$\u0003\u0002\u0002",
    "\u0002\u001c\u001a\u0003\u0002\u0002\u0002\u001d!\u0005\r\u0007\u0002",
    "\u001e \u0005\u000b\u0006\u0002\u001f\u001e\u0003\u0002\u0002\u0002",
    " #\u0003\u0002\u0002\u0002!\u001f\u0003\u0002\u0002\u0002!\"\u0003\u0002",
    "\u0002\u0002\"%\u0003\u0002\u0002\u0002#!\u0003\u0002\u0002\u0002$\u001d",
    "\u0003\u0002\u0002\u0002%&\u0003\u0002\u0002\u0002&$\u0003\u0002\u0002",
    "\u0002&\'\u0003\u0002\u0002\u0002\'(\u0003\u0002\u0002\u0002()\u0005",
    "\t\u0005\u0002)\b\u0003\u0002\u0002\u0002*+\u0007$\u0002\u0002+\n\u0003",
    "\u0002\u0002\u0002,-\n\u0002\u0002\u0002-\f\u0003\u0002\u0002\u0002",
    ".2\u00070\u0002\u0002/0\u0007$\u0002\u000202\u0007$\u0002\u00021.\u0003",
    "\u0002\u0002\u00021/\u0003\u0002\u0002\u00022\u000e\u0003\u0002\u0002",
    "\u0002\b\u0002\u0014\u001a!&1\u0002"].join("");


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

export default class FqnLexer extends antlr4.Lexer {

    static grammarFileName = "Fqn.g4";
    static channelNames = [ "DEFAULT_TOKEN_CHANNEL", "HIDDEN" ];
	static modeNames = [ "DEFAULT_MODE" ];
	static literalNames = [ null, "'.'", null, null, "'\"'" ];
	static symbolicNames = [ null, null, "NAME", "NAME_WITH_RESERVED", "QUOTE", 
                          "NON_RESERVED", "RESERVED" ];
	static ruleNames = [ "T__0", "NAME", "NAME_WITH_RESERVED", "QUOTE", "NON_RESERVED", 
                      "RESERVED" ];

    constructor(input) {
        super(input)
        this._interp = new antlr4.atn.LexerATNSimulator(this, atn, decisionsToDFA, new antlr4.PredictionContextCache());
    }

    get atn() {
        return atn;
    }
}

FqnLexer.EOF = antlr4.Token.EOF;
FqnLexer.T__0 = 1;
FqnLexer.NAME = 2;
FqnLexer.NAME_WITH_RESERVED = 3;
FqnLexer.QUOTE = 4;
FqnLexer.NON_RESERVED = 5;
FqnLexer.RESERVED = 6;



