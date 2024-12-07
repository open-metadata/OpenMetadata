// Generated from /Users/harsha/Code/OpenMetadata/openmetadata-ui/src/main/resources/ui/../../../../../openmetadata-spec/src/main/antlr4/org/openmetadata/schema/JdbcUri.g4 by ANTLR 4.9.2
// jshint ignore: start
import antlr4 from 'antlr4';
import JdbcUriListener from './JdbcUriListener.js';

const serializedATN = ["\u0003\u608b\ua72a\u8133\ub9ed\u417c\u3be7\u7786",
    "\u5964\u0003\u0012@\u0004\u0002\t\u0002\u0004\u0003\t\u0003\u0004\u0004",
    "\t\u0004\u0004\u0005\t\u0005\u0004\u0006\t\u0006\u0004\u0007\t\u0007",
    "\u0003\u0002\u0003\u0002\u0003\u0002\u0005\u0002\u0012\n\u0002\u0003",
    "\u0002\u0005\u0002\u0015\n\u0002\u0003\u0002\u0003\u0002\u0005\u0002",
    "\u0019\n\u0002\u0003\u0002\u0003\u0002\u0003\u0002\u0003\u0002\u0007",
    "\u0002\u001f\n\u0002\f\u0002\u000e\u0002\"\u000b\u0002\u0005\u0002$",
    "\n\u0002\u0003\u0002\u0005\u0002\'\n\u0002\u0003\u0003\u0003\u0003\u0003",
    "\u0003\u0003\u0003\u0005\u0003-\n\u0003\u0003\u0003\u0003\u0003\u0003",
    "\u0004\u0005\u00042\n\u0004\u0003\u0005\u0003\u0005\u0003\u0006\u0003",
    "\u0006\u0003\u0007\u0003\u0007\u0003\u0007\u0003\u0007\u0003\u0007\u0003",
    "\u0007\u0005\u0007>\n\u0007\u0003\u0007\u0002\u0002\b\u0002\u0004\u0006",
    "\b\n\f\u0002\u0002\u0002E\u0002\u000e\u0003\u0002\u0002\u0002\u0004",
    "(\u0003\u0002\u0002\u0002\u00061\u0003\u0002\u0002\u0002\b3\u0003\u0002",
    "\u0002\u0002\n5\u0003\u0002\u0002\u0002\f=\u0003\u0002\u0002\u0002\u000e",
    "\u000f\u0007\u0003\u0002\u0002\u000f\u0011\u0007\u0005\u0002\u0002\u0010",
    "\u0012\u0005\f\u0007\u0002\u0011\u0010\u0003\u0002\u0002\u0002\u0011",
    "\u0012\u0003\u0002\u0002\u0002\u0012\u0014\u0003\u0002\u0002\u0002\u0013",
    "\u0015\u0007\u0007\u0002\u0002\u0014\u0013\u0003\u0002\u0002\u0002\u0014",
    "\u0015\u0003\u0002\u0002\u0002\u0015\u0018\u0003\u0002\u0002\u0002\u0016",
    "\u0017\u0007\u0004\u0002\u0002\u0017\u0019\u0005\u0006\u0004\u0002\u0018",
    "\u0016\u0003\u0002\u0002\u0002\u0018\u0019\u0003\u0002\u0002\u0002\u0019",
    "#\u0003\u0002\u0002\u0002\u001a\u001b\u0007\u000e\u0002\u0002\u001b",
    " \u0007\r\u0002\u0002\u001c\u001d\u0007\u0011\u0002\u0002\u001d\u001f",
    "\u0007\r\u0002\u0002\u001e\u001c\u0003\u0002\u0002\u0002\u001f\"\u0003",
    "\u0002\u0002\u0002 \u001e\u0003\u0002\u0002\u0002 !\u0003\u0002\u0002",
    "\u0002!$\u0003\u0002\u0002\u0002\" \u0003\u0002\u0002\u0002#\u001a\u0003",
    "\u0002\u0002\u0002#$\u0003\u0002\u0002\u0002$&\u0003\u0002\u0002\u0002",
    "%\'\u0005\u0004\u0003\u0002&%\u0003\u0002\u0002\u0002&\'\u0003\u0002",
    "\u0002\u0002\'\u0003\u0003\u0002\u0002\u0002(,\u0007\u0010\u0002\u0002",
    ")*\u0005\b\u0005\u0002*+\u0007\u000f\u0002\u0002+-\u0003\u0002\u0002",
    "\u0002,)\u0003\u0002\u0002\u0002,-\u0003\u0002\u0002\u0002-.\u0003\u0002",
    "\u0002\u0002./\u0005\n\u0006\u0002/\u0005\u0003\u0002\u0002\u000202",
    "\u0007\b\u0002\u000210\u0003\u0002\u0002\u000212\u0003\u0002\u0002\u0002",
    "2\u0007\u0003\u0002\u0002\u000234\u0007\b\u0002\u00024\t\u0003\u0002",
    "\u0002\u000256\u0007\b\u0002\u00026\u000b\u0003\u0002\u0002\u00027>",
    "\u0007\t\u0002\u00028>\u0007\n\u0002\u00029>\u0007\u000b\u0002\u0002",
    ":;\u0007\u0006\u0002\u0002;>\u0007\b\u0002\u0002<>\u0007\u0006\u0002",
    "\u0002=7\u0003\u0002\u0002\u0002=8\u0003\u0002\u0002\u0002=9\u0003\u0002",
    "\u0002\u0002=:\u0003\u0002\u0002\u0002=<\u0003\u0002\u0002\u0002>\r",
    "\u0003\u0002\u0002\u0002\u000b\u0011\u0014\u0018 #&,1="].join("");


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.PredictionContextCache();

export default class JdbcUriParser extends antlr4.Parser {

    static grammarFileName = "JdbcUri.g4";
    static literalNames = [ null, "'jdbc:'", "'/'", null, null, null, null, 
                            null, null, null, null, null, "'?'", "'.'", 
                            "':'", "'&'" ];
    static symbolicNames = [ null, null, null, "DATABASE_TYPE", "URI_SEPARATOR", 
                             "PORT_NUMBER", "IDENTIFIER", "HOST_NAME", "IPV4_ADDRESS", 
                             "IPV6_ADDRESS", "HEXDIGIT", "CONNECTION_ARG", 
                             "CONNECTION_ARG_INIT", "PERIOD", "COLON", "AMP", 
                             "WS" ];
    static ruleNames = [ "jdbcUrl", "schemaTable", "databaseName", "schemaName", 
                         "tableName", "serverName" ];

    constructor(input) {
        super(input);
        this._interp = new antlr4.atn.ParserATNSimulator(this, atn, decisionsToDFA, sharedContextCache);
        this.ruleNames = JdbcUriParser.ruleNames;
        this.literalNames = JdbcUriParser.literalNames;
        this.symbolicNames = JdbcUriParser.symbolicNames;
    }

    get atn() {
        return atn;
    }



	jdbcUrl() {
	    let localctx = new JdbcUrlContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 0, JdbcUriParser.RULE_jdbcUrl);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 12;
	        this.match(JdbcUriParser.T__0);
	        this.state = 13;
	        this.match(JdbcUriParser.DATABASE_TYPE);
	        this.state = 15;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if((((_la) & ~0x1f) == 0 && ((1 << _la) & ((1 << JdbcUriParser.URI_SEPARATOR) | (1 << JdbcUriParser.HOST_NAME) | (1 << JdbcUriParser.IPV4_ADDRESS) | (1 << JdbcUriParser.IPV6_ADDRESS))) !== 0)) {
	            this.state = 14;
	            this.serverName();
	        }

	        this.state = 18;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===JdbcUriParser.PORT_NUMBER) {
	            this.state = 17;
	            this.match(JdbcUriParser.PORT_NUMBER);
	        }

	        this.state = 22;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===JdbcUriParser.T__1) {
	            this.state = 20;
	            this.match(JdbcUriParser.T__1);
	            this.state = 21;
	            this.databaseName();
	        }

	        this.state = 33;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===JdbcUriParser.CONNECTION_ARG_INIT) {
	            this.state = 24;
	            this.match(JdbcUriParser.CONNECTION_ARG_INIT);
	            this.state = 25;
	            this.match(JdbcUriParser.CONNECTION_ARG);
	            this.state = 30;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	            while(_la===JdbcUriParser.AMP) {
	                this.state = 26;
	                this.match(JdbcUriParser.AMP);
	                this.state = 27;
	                this.match(JdbcUriParser.CONNECTION_ARG);
	                this.state = 32;
	                this._errHandler.sync(this);
	                _la = this._input.LA(1);
	            }
	        }

	        this.state = 36;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===JdbcUriParser.COLON) {
	            this.state = 35;
	            this.schemaTable();
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



	schemaTable() {
	    let localctx = new SchemaTableContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 2, JdbcUriParser.RULE_schemaTable);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 38;
	        this.match(JdbcUriParser.COLON);
	        this.state = 42;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,6,this._ctx);
	        if(la_===1) {
	            this.state = 39;
	            this.schemaName();
	            this.state = 40;
	            this.match(JdbcUriParser.PERIOD);

	        }
	        this.state = 44;
	        this.tableName();
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



	databaseName() {
	    let localctx = new DatabaseNameContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 4, JdbcUriParser.RULE_databaseName);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 47;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        if(_la===JdbcUriParser.IDENTIFIER) {
	            this.state = 46;
	            this.match(JdbcUriParser.IDENTIFIER);
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



	schemaName() {
	    let localctx = new SchemaNameContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 6, JdbcUriParser.RULE_schemaName);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 49;
	        this.match(JdbcUriParser.IDENTIFIER);
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



	tableName() {
	    let localctx = new TableNameContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 8, JdbcUriParser.RULE_tableName);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 51;
	        this.match(JdbcUriParser.IDENTIFIER);
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



	serverName() {
	    let localctx = new ServerNameContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 10, JdbcUriParser.RULE_serverName);
	    try {
	        this.state = 59;
	        this._errHandler.sync(this);
	        var la_ = this._interp.adaptivePredict(this._input,8,this._ctx);
	        switch(la_) {
	        case 1:
	            this.enterOuterAlt(localctx, 1);
	            this.state = 53;
	            this.match(JdbcUriParser.HOST_NAME);
	            break;

	        case 2:
	            this.enterOuterAlt(localctx, 2);
	            this.state = 54;
	            this.match(JdbcUriParser.IPV4_ADDRESS);
	            break;

	        case 3:
	            this.enterOuterAlt(localctx, 3);
	            this.state = 55;
	            this.match(JdbcUriParser.IPV6_ADDRESS);
	            break;

	        case 4:
	            this.enterOuterAlt(localctx, 4);
	            this.state = 56;
	            this.match(JdbcUriParser.URI_SEPARATOR);
	            this.state = 57;
	            this.match(JdbcUriParser.IDENTIFIER);
	            break;

	        case 5:
	            this.enterOuterAlt(localctx, 5);
	            this.state = 58;
	            this.match(JdbcUriParser.URI_SEPARATOR);
	            break;

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

JdbcUriParser.EOF = antlr4.Token.EOF;
JdbcUriParser.T__0 = 1;
JdbcUriParser.T__1 = 2;
JdbcUriParser.DATABASE_TYPE = 3;
JdbcUriParser.URI_SEPARATOR = 4;
JdbcUriParser.PORT_NUMBER = 5;
JdbcUriParser.IDENTIFIER = 6;
JdbcUriParser.HOST_NAME = 7;
JdbcUriParser.IPV4_ADDRESS = 8;
JdbcUriParser.IPV6_ADDRESS = 9;
JdbcUriParser.HEXDIGIT = 10;
JdbcUriParser.CONNECTION_ARG = 11;
JdbcUriParser.CONNECTION_ARG_INIT = 12;
JdbcUriParser.PERIOD = 13;
JdbcUriParser.COLON = 14;
JdbcUriParser.AMP = 15;
JdbcUriParser.WS = 16;

JdbcUriParser.RULE_jdbcUrl = 0;
JdbcUriParser.RULE_schemaTable = 1;
JdbcUriParser.RULE_databaseName = 2;
JdbcUriParser.RULE_schemaName = 3;
JdbcUriParser.RULE_tableName = 4;
JdbcUriParser.RULE_serverName = 5;

class JdbcUrlContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = JdbcUriParser.RULE_jdbcUrl;
    }

	DATABASE_TYPE() {
	    return this.getToken(JdbcUriParser.DATABASE_TYPE, 0);
	};

	serverName() {
	    return this.getTypedRuleContext(ServerNameContext,0);
	};

	PORT_NUMBER() {
	    return this.getToken(JdbcUriParser.PORT_NUMBER, 0);
	};

	databaseName() {
	    return this.getTypedRuleContext(DatabaseNameContext,0);
	};

	CONNECTION_ARG_INIT() {
	    return this.getToken(JdbcUriParser.CONNECTION_ARG_INIT, 0);
	};

	CONNECTION_ARG = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(JdbcUriParser.CONNECTION_ARG);
	    } else {
	        return this.getToken(JdbcUriParser.CONNECTION_ARG, i);
	    }
	};


	schemaTable() {
	    return this.getTypedRuleContext(SchemaTableContext,0);
	};

	AMP = function(i) {
		if(i===undefined) {
			i = null;
		}
	    if(i===null) {
	        return this.getTokens(JdbcUriParser.AMP);
	    } else {
	        return this.getToken(JdbcUriParser.AMP, i);
	    }
	};


	enterRule(listener) {
	    if(listener instanceof JdbcUriListener ) {
	        listener.enterJdbcUrl(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof JdbcUriListener ) {
	        listener.exitJdbcUrl(this);
		}
	}


}



class SchemaTableContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = JdbcUriParser.RULE_schemaTable;
    }

	COLON() {
	    return this.getToken(JdbcUriParser.COLON, 0);
	};

	tableName() {
	    return this.getTypedRuleContext(TableNameContext,0);
	};

	schemaName() {
	    return this.getTypedRuleContext(SchemaNameContext,0);
	};

	PERIOD() {
	    return this.getToken(JdbcUriParser.PERIOD, 0);
	};

	enterRule(listener) {
	    if(listener instanceof JdbcUriListener ) {
	        listener.enterSchemaTable(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof JdbcUriListener ) {
	        listener.exitSchemaTable(this);
		}
	}


}



class DatabaseNameContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = JdbcUriParser.RULE_databaseName;
    }

	IDENTIFIER() {
	    return this.getToken(JdbcUriParser.IDENTIFIER, 0);
	};

	enterRule(listener) {
	    if(listener instanceof JdbcUriListener ) {
	        listener.enterDatabaseName(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof JdbcUriListener ) {
	        listener.exitDatabaseName(this);
		}
	}


}



class SchemaNameContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = JdbcUriParser.RULE_schemaName;
    }

	IDENTIFIER() {
	    return this.getToken(JdbcUriParser.IDENTIFIER, 0);
	};

	enterRule(listener) {
	    if(listener instanceof JdbcUriListener ) {
	        listener.enterSchemaName(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof JdbcUriListener ) {
	        listener.exitSchemaName(this);
		}
	}


}



class TableNameContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = JdbcUriParser.RULE_tableName;
    }

	IDENTIFIER() {
	    return this.getToken(JdbcUriParser.IDENTIFIER, 0);
	};

	enterRule(listener) {
	    if(listener instanceof JdbcUriListener ) {
	        listener.enterTableName(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof JdbcUriListener ) {
	        listener.exitTableName(this);
		}
	}


}



class ServerNameContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = JdbcUriParser.RULE_serverName;
    }

	HOST_NAME() {
	    return this.getToken(JdbcUriParser.HOST_NAME, 0);
	};

	IPV4_ADDRESS() {
	    return this.getToken(JdbcUriParser.IPV4_ADDRESS, 0);
	};

	IPV6_ADDRESS() {
	    return this.getToken(JdbcUriParser.IPV6_ADDRESS, 0);
	};

	URI_SEPARATOR() {
	    return this.getToken(JdbcUriParser.URI_SEPARATOR, 0);
	};

	IDENTIFIER() {
	    return this.getToken(JdbcUriParser.IDENTIFIER, 0);
	};

	enterRule(listener) {
	    if(listener instanceof JdbcUriListener ) {
	        listener.enterServerName(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof JdbcUriListener ) {
	        listener.exitServerName(this);
		}
	}


}




JdbcUriParser.JdbcUrlContext = JdbcUrlContext; 
JdbcUriParser.SchemaTableContext = SchemaTableContext; 
JdbcUriParser.DatabaseNameContext = DatabaseNameContext; 
JdbcUriParser.SchemaNameContext = SchemaNameContext; 
JdbcUriParser.TableNameContext = TableNameContext; 
JdbcUriParser.ServerNameContext = ServerNameContext; 
