// Generated from /Users/amiorin/code/OpenMetadata/openmetadata-ui/src/main/resources/ui/../../../../../catalog-rest-service/src/main/antlr4/org/openmetadata/catalog/Fqn.g4 by ANTLR 4.9.3
// jshint ignore: start
import antlr4 from 'antlr4';
import FqnListener from './FqnListener.js';

const serializedATN = ["\u0003\u608b\ua72a\u8133\ub9ed\u417c\u3be7\u7786",
    "\u5964\u0003\u0007\u0015\u0004\u0002\t\u0002\u0004\u0003\t\u0003\u0003",
    "\u0002\u0003\u0002\u0003\u0002\u0007\u0002\n\n\u0002\f\u0002\u000e\u0002",
    "\r\u000b\u0002\u0003\u0002\u0003\u0002\u0003\u0003\u0003\u0003\u0005",
    "\u0003\u0013\n\u0003\u0003\u0003\u0002\u0002\u0004\u0002\u0004\u0002",
    "\u0002\u0002\u0014\u0002\u0006\u0003\u0002\u0002\u0002\u0004\u0012\u0003",
    "\u0002\u0002\u0002\u0006\u000b\u0005\u0004\u0003\u0002\u0007\b\u0007",
    "\u0007\u0002\u0002\b\n\u0005\u0004\u0003\u0002\t\u0007\u0003\u0002\u0002",
    "\u0002\n\r\u0003\u0002\u0002\u0002\u000b\t\u0003\u0002\u0002\u0002\u000b",
    "\f\u0003\u0002\u0002\u0002\f\u000e\u0003\u0002\u0002\u0002\r\u000b\u0003",
    "\u0002\u0002\u0002\u000e\u000f\u0007\u0002\u0002\u0003\u000f\u0003\u0003",
    "\u0002\u0002\u0002\u0010\u0013\u0007\u0003\u0002\u0002\u0011\u0013\u0007",
    "\u0004\u0002\u0002\u0012\u0010\u0003\u0002\u0002\u0002\u0012\u0011\u0003",
    "\u0002\u0002\u0002\u0013\u0005\u0003\u0002\u0002\u0002\u0004\u000b\u0012"].join("");


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.PredictionContextCache();

export default class FqnParser extends antlr4.Parser {

    static grammarFileName = "Fqn.g4";
    static literalNames = [ null, null, null, "'\"'", null, "'.'" ];
    static symbolicNames = [ null, "NAME", "NAME_WITH_RESERVED", "QUOTE", 
                             "NON_RESERVED", "RESERVED" ];
    static ruleNames = [ "fqn", "name" ];

    constructor(input) {
        super(input);
        this._interp = new antlr4.atn.ParserATNSimulator(this, atn, decisionsToDFA, sharedContextCache);
        this.ruleNames = FqnParser.ruleNames;
        this.literalNames = FqnParser.literalNames;
        this.symbolicNames = FqnParser.symbolicNames;
    }

    get atn() {
        return atn;
    }



	fqn() {
	    let localctx = new FqnContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 0, FqnParser.RULE_fqn);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 4;
	        this.name();
	        this.state = 9;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===FqnParser.RESERVED) {
	            this.state = 5;
	            this.match(FqnParser.RESERVED);
	            this.state = 6;
	            this.name();
	            this.state = 11;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 12;
	        this.match(FqnParser.EOF);
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}



	name() {
	    let localctx = new NameContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 2, FqnParser.RULE_name);
	    try {
	        this.state = 16;
	        this._errHandler.sync(this);
	        switch(this._input.LA(1)) {
	        case FqnParser.NAME:
	            localctx = new UnquotedNameContext(this, localctx);
	            this.enterOuterAlt(localctx, 1);
	            this.state = 14;
	            this.match(FqnParser.NAME);
	            break;
	        case FqnParser.NAME_WITH_RESERVED:
	            localctx = new QuotedNameContext(this, localctx);
	            this.enterOuterAlt(localctx, 2);
	            this.state = 15;
	            this.match(FqnParser.NAME_WITH_RESERVED);
	            break;
	        default:
	            throw new antlr4.error.NoViableAltException(this);
	        }
	    } catch (re) {
	    	if(re instanceof antlr4.error.RecognitionException) {
		        localctx.exception = re;
		        this._errHandler.reportError(this, re);
		        this._errHandler.recover(this, re);
		    } else {
		    	throw re;
		    }
	    } finally {
	        this.exitRule();
	    }
	    return localctx;
	}


}

FqnParser.EOF = antlr4.Token.EOF;
FqnParser.NAME = 1;
FqnParser.NAME_WITH_RESERVED = 2;
FqnParser.QUOTE = 3;
FqnParser.NON_RESERVED = 4;
FqnParser.RESERVED = 5;

FqnParser.RULE_fqn = 0;
FqnParser.RULE_name = 1;

class FqnContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = FqnParser.RULE_fqn;
    }

	name = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(NameContext);
	    } else {
	        return this.getTypedRuleContext(NameContext,i);
	    }
	};

	EOF() {
	    return this.getToken(FqnParser.EOF, 0);
	};

	RESERVED = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(FqnParser.RESERVED);
	    } else {
	        return this.getToken(FqnParser.RESERVED, i);
	    }
	};


	enterRule(listener) {
	    if(listener instanceof FqnListener ) {
	        listener.enterFqn(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof FqnListener ) {
	        listener.exitFqn(this);
		}
	}


}



class NameContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = FqnParser.RULE_name;
    }


	 
		copyFrom(ctx) {
			super.copyFrom(ctx);
		}

}


class QuotedNameContext extends NameContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	NAME_WITH_RESERVED() {
	    return this.getToken(FqnParser.NAME_WITH_RESERVED, 0);
	};

	enterRule(listener) {
	    if(listener instanceof FqnListener ) {
	        listener.enterQuotedName(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof FqnListener ) {
	        listener.exitQuotedName(this);
		}
	}


}

FqnParser.QuotedNameContext = QuotedNameContext;

class UnquotedNameContext extends NameContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	NAME() {
	    return this.getToken(FqnParser.NAME, 0);
	};

	enterRule(listener) {
	    if(listener instanceof FqnListener ) {
	        listener.enterUnquotedName(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof FqnListener ) {
	        listener.exitUnquotedName(this);
		}
	}


}

FqnParser.UnquotedNameContext = UnquotedNameContext;


FqnParser.FqnContext = FqnContext; 
FqnParser.NameContext = NameContext; 
