// Generated from /Users/amiorin/code/OpenMetadata/openmetadata-ui/src/main/resources/ui/../../../../../catalog-rest-service/src/main/antlr4/org/openmetadata/catalog/Fqn.g4 by ANTLR 4.9.3
// jshint ignore: start
import antlr4 from 'antlr4';



const serializedATN = ["\u0003\u608b\ua72a\u8133\ub9ed\u417c\u3be7\u7786",
    "\u5964\u0002\u0007,\b\u0001\u0004\u0002\t\u0002\u0004\u0003\t\u0003",
    "\u0004\u0004\t\u0004\u0004\u0005\t\u0005\u0004\u0006\t\u0006\u0003\u0002",
    "\u0006\u0002\u000f\n\u0002\r\u0002\u000e\u0002\u0010\u0003\u0003\u0003",
    "\u0003\u0007\u0003\u0015\n\u0003\f\u0003\u000e\u0003\u0018\u000b\u0003",
    "\u0003\u0003\u0003\u0003\u0007\u0003\u001c\n\u0003\f\u0003\u000e\u0003",
    "\u001f\u000b\u0003\u0006\u0003!\n\u0003\r\u0003\u000e\u0003\"\u0003",
    "\u0003\u0003\u0003\u0003\u0004\u0003\u0004\u0003\u0005\u0003\u0005\u0003",
    "\u0006\u0003\u0006\u0002\u0002\u0007\u0003\u0003\u0005\u0004\u0007\u0005",
    "\t\u0006\u000b\u0007\u0003\u0002\u0003\u0004\u0002$$00\u0002/\u0002",
    "\u0003\u0003\u0002\u0002\u0002\u0002\u0005\u0003\u0002\u0002\u0002\u0002",
    "\u0007\u0003\u0002\u0002\u0002\u0002\t\u0003\u0002\u0002\u0002\u0002",
    "\u000b\u0003\u0002\u0002\u0002\u0003\u000e\u0003\u0002\u0002\u0002\u0005",
    "\u0012\u0003\u0002\u0002\u0002\u0007&\u0003\u0002\u0002\u0002\t(\u0003",
    "\u0002\u0002\u0002\u000b*\u0003\u0002\u0002\u0002\r\u000f\u0005\t\u0005",
    "\u0002\u000e\r\u0003\u0002\u0002\u0002\u000f\u0010\u0003\u0002\u0002",
    "\u0002\u0010\u000e\u0003\u0002\u0002\u0002\u0010\u0011\u0003\u0002\u0002",
    "\u0002\u0011\u0004\u0003\u0002\u0002\u0002\u0012\u0016\u0005\u0007\u0004",
    "\u0002\u0013\u0015\u0005\t\u0005\u0002\u0014\u0013\u0003\u0002\u0002",
    "\u0002\u0015\u0018\u0003\u0002\u0002\u0002\u0016\u0014\u0003\u0002\u0002",
    "\u0002\u0016\u0017\u0003\u0002\u0002\u0002\u0017 \u0003\u0002\u0002",
    "\u0002\u0018\u0016\u0003\u0002\u0002\u0002\u0019\u001d\u0005\u000b\u0006",
    "\u0002\u001a\u001c\u0005\t\u0005\u0002\u001b\u001a\u0003\u0002\u0002",
    "\u0002\u001c\u001f\u0003\u0002\u0002\u0002\u001d\u001b\u0003\u0002\u0002",
    "\u0002\u001d\u001e\u0003\u0002\u0002\u0002\u001e!\u0003\u0002\u0002",
    "\u0002\u001f\u001d\u0003\u0002\u0002\u0002 \u0019\u0003\u0002\u0002",
    "\u0002!\"\u0003\u0002\u0002\u0002\" \u0003\u0002\u0002\u0002\"#\u0003",
    "\u0002\u0002\u0002#$\u0003\u0002\u0002\u0002$%\u0005\u0007\u0004\u0002",
    "%\u0006\u0003\u0002\u0002\u0002&\'\u0007$\u0002\u0002\'\b\u0003\u0002",
    "\u0002\u0002()\n\u0002\u0002\u0002)\n\u0003\u0002\u0002\u0002*+\u0007",
    "0\u0002\u0002+\f\u0003\u0002\u0002\u0002\u0007\u0002\u0010\u0016\u001d",
    "\"\u0002"].join("");


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

export default class FqnLexer extends antlr4.Lexer {

    static grammarFileName = "Fqn.g4";
    static channelNames = [ "DEFAULT_TOKEN_CHANNEL", "HIDDEN" ];
	static modeNames = [ "DEFAULT_MODE" ];
	static literalNames = [ null, null, null, "'\"'", null, "'.'" ];
	static symbolicNames = [ null, "NAME", "NAME_WITH_RESERVED", "QUOTE", "NON_RESERVED", 
                          "RESERVED" ];
	static ruleNames = [ "NAME", "NAME_WITH_RESERVED", "QUOTE", "NON_RESERVED", 
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
FqnLexer.NAME = 1;
FqnLexer.NAME_WITH_RESERVED = 2;
FqnLexer.QUOTE = 3;
FqnLexer.NON_RESERVED = 4;
FqnLexer.RESERVED = 5;



