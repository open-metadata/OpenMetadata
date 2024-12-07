// Generated from /Users/harsha/Code/OpenMetadata/openmetadata-ui/src/main/resources/ui/../../../../../openmetadata-spec/src/main/antlr4/org/openmetadata/schema/EntityLink.g4 by ANTLR 4.9.2
// jshint ignore: start
import antlr4 from 'antlr4';
import EntityLinkListener from './EntityLinkListener.js';

const serializedATN = ["\u0003\u608b\ua72a\u8133\ub9ed\u417c\u3be7\u7786",
    "\u5964\u0003\b1\u0004\u0002\t\u0002\u0004\u0003\t\u0003\u0004\u0004",
    "\t\u0004\u0004\u0005\t\u0005\u0004\u0006\t\u0006\u0003\u0002\u0003\u0002",
    "\u0003\u0002\u0003\u0002\u0003\u0002\u0003\u0002\u0006\u0002\u0013\n",
    "\u0002\r\u0002\u000e\u0002\u0014\u0003\u0002\u0003\u0002\u0003\u0002",
    "\u0003\u0002\u0003\u0002\u0007\u0002\u001c\n\u0002\f\u0002\u000e\u0002",
    "\u001f\u000b\u0002\u0007\u0002!\n\u0002\f\u0002\u000e\u0002$\u000b\u0002",
    "\u0003\u0002\u0003\u0002\u0003\u0002\u0003\u0003\u0003\u0003\u0003\u0004",
    "\u0003\u0004\u0003\u0005\u0003\u0005\u0003\u0006\u0003\u0006\u0003\u0006",
    "\u0002\u0002\u0007\u0002\u0004\u0006\b\n\u0002\u0002\u0002.\u0002\f",
    "\u0003\u0002\u0002\u0002\u0004(\u0003\u0002\u0002\u0002\u0006*\u0003",
    "\u0002\u0002\u0002\b,\u0003\u0002\u0002\u0002\n.\u0003\u0002\u0002\u0002",
    "\f\u0012\u0007\u0005\u0002\u0002\r\u000e\u0005\n\u0006\u0002\u000e\u000f",
    "\u0005\u0004\u0003\u0002\u000f\u0010\u0005\n\u0006\u0002\u0010\u0011",
    "\u0005\u0006\u0004\u0002\u0011\u0013\u0003\u0002\u0002\u0002\u0012\r",
    "\u0003\u0002\u0002\u0002\u0013\u0014\u0003\u0002\u0002\u0002\u0014\u0012",
    "\u0003\u0002\u0002\u0002\u0014\u0015\u0003\u0002\u0002\u0002\u0015\"",
    "\u0003\u0002\u0002\u0002\u0016\u0017\u0005\n\u0006\u0002\u0017\u001d",
    "\u0005\b\u0005\u0002\u0018\u0019\u0005\n\u0006\u0002\u0019\u001a\u0005",
    "\u0006\u0004\u0002\u001a\u001c\u0003\u0002\u0002\u0002\u001b\u0018\u0003",
    "\u0002\u0002\u0002\u001c\u001f\u0003\u0002\u0002\u0002\u001d\u001b\u0003",
    "\u0002\u0002\u0002\u001d\u001e\u0003\u0002\u0002\u0002\u001e!\u0003",
    "\u0002\u0002\u0002\u001f\u001d\u0003\u0002\u0002\u0002 \u0016\u0003",
    "\u0002\u0002\u0002!$\u0003\u0002\u0002\u0002\" \u0003\u0002\u0002\u0002",
    "\"#\u0003\u0002\u0002\u0002#%\u0003\u0002\u0002\u0002$\"\u0003\u0002",
    "\u0002\u0002%&\u0007\u0003\u0002\u0002&\'\u0007\u0002\u0002\u0003\'",
    "\u0003\u0003\u0002\u0002\u0002()\u0007\u0006\u0002\u0002)\u0005\u0003",
    "\u0002\u0002\u0002*+\u0007\b\u0002\u0002+\u0007\u0003\u0002\u0002\u0002",
    ",-\u0007\u0007\u0002\u0002-\t\u0003\u0002\u0002\u0002./\u0007\u0004",
    "\u0002\u0002/\u000b\u0003\u0002\u0002\u0002\u0005\u0014\u001d\""].join("");


const atn = new antlr4.atn.ATNDeserializer().deserialize(serializedATN);

const decisionsToDFA = atn.decisionToState.map( (ds, index) => new antlr4.dfa.DFA(ds, index) );

const sharedContextCache = new antlr4.PredictionContextCache();

export default class EntityLinkParser extends antlr4.Parser {

    static grammarFileName = "EntityLink.g4";
    static literalNames = [ null, "'>'", "'::'", "'<#E'" ];
    static symbolicNames = [ null, null, null, "RESERVED_START", "ENTITY_TYPE", 
                             "ENTITY_FIELD", "NAME_OR_FQN" ];
    static ruleNames = [ "entitylink", "entity_type", "name_or_fqn", "entity_field", 
                         "separator" ];

    constructor(input) {
        super(input);
        this._interp = new antlr4.atn.ParserATNSimulator(this, atn, decisionsToDFA, sharedContextCache);
        this.ruleNames = EntityLinkParser.ruleNames;
        this.literalNames = EntityLinkParser.literalNames;
        this.symbolicNames = EntityLinkParser.symbolicNames;
    }

    get atn() {
        return atn;
    }



	entitylink() {
	    let localctx = new EntitylinkContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 0, EntityLinkParser.RULE_entitylink);
	    var _la = 0; // Token type
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 10;
	        this.match(EntityLinkParser.RESERVED_START);
	        this.state = 16; 
	        this._errHandler.sync(this);
	        var _alt = 1;
	        do {
	        	switch (_alt) {
	        	case 1:
	        		this.state = 11;
	        		this.separator();
	        		this.state = 12;
	        		this.entity_type();
	        		this.state = 13;
	        		this.separator();
	        		this.state = 14;
	        		this.name_or_fqn();
	        		break;
	        	default:
	        		throw new antlr4.error.NoViableAltException(this);
	        	}
	        	this.state = 18; 
	        	this._errHandler.sync(this);
	        	_alt = this._interp.adaptivePredict(this._input,0, this._ctx);
	        } while ( _alt!=2 && _alt!=antlr4.atn.ATN.INVALID_ALT_NUMBER );
	        this.state = 32;
	        this._errHandler.sync(this);
	        _la = this._input.LA(1);
	        while(_la===EntityLinkParser.T__1) {
	            this.state = 20;
	            this.separator();
	            this.state = 21;
	            this.entity_field();
	            this.state = 27;
	            this._errHandler.sync(this);
	            var _alt = this._interp.adaptivePredict(this._input,1,this._ctx)
	            while(_alt!=2 && _alt!=antlr4.atn.ATN.INVALID_ALT_NUMBER) {
	                if(_alt===1) {
	                    this.state = 22;
	                    this.separator();
	                    this.state = 23;
	                    this.name_or_fqn(); 
	                }
	                this.state = 29;
	                this._errHandler.sync(this);
	                _alt = this._interp.adaptivePredict(this._input,1,this._ctx);
	            }

	            this.state = 34;
	            this._errHandler.sync(this);
	            _la = this._input.LA(1);
	        }
	        this.state = 35;
	        this.match(EntityLinkParser.T__0);
	        this.state = 36;
	        this.match(EntityLinkParser.EOF);
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



	entity_type() {
	    let localctx = new Entity_typeContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 2, EntityLinkParser.RULE_entity_type);
	    try {
	        localctx = new EntityTypeContext(this, localctx);
	        this.enterOuterAlt(localctx, 1);
	        this.state = 38;
	        this.match(EntityLinkParser.ENTITY_TYPE);
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



	name_or_fqn() {
	    let localctx = new Name_or_fqnContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 4, EntityLinkParser.RULE_name_or_fqn);
	    try {
	        localctx = new NameOrFQNContext(this, localctx);
	        this.enterOuterAlt(localctx, 1);
	        this.state = 40;
	        this.match(EntityLinkParser.NAME_OR_FQN);
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



	entity_field() {
	    let localctx = new Entity_fieldContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 6, EntityLinkParser.RULE_entity_field);
	    try {
	        localctx = new EntityFieldContext(this, localctx);
	        this.enterOuterAlt(localctx, 1);
	        this.state = 42;
	        this.match(EntityLinkParser.ENTITY_FIELD);
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



	separator() {
	    let localctx = new SeparatorContext(this, this._ctx, this.state);
	    this.enterRule(localctx, 8, EntityLinkParser.RULE_separator);
	    try {
	        this.enterOuterAlt(localctx, 1);
	        this.state = 44;
	        this.match(EntityLinkParser.T__1);
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

EntityLinkParser.EOF = antlr4.Token.EOF;
EntityLinkParser.T__0 = 1;
EntityLinkParser.T__1 = 2;
EntityLinkParser.RESERVED_START = 3;
EntityLinkParser.ENTITY_TYPE = 4;
EntityLinkParser.ENTITY_FIELD = 5;
EntityLinkParser.NAME_OR_FQN = 6;

EntityLinkParser.RULE_entitylink = 0;
EntityLinkParser.RULE_entity_type = 1;
EntityLinkParser.RULE_name_or_fqn = 2;
EntityLinkParser.RULE_entity_field = 3;
EntityLinkParser.RULE_separator = 4;

class EntitylinkContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = EntityLinkParser.RULE_entitylink;
    }

	RESERVED_START() {
	    return this.getToken(EntityLinkParser.RESERVED_START, 0);
	};

	EOF() {
	    return this.getToken(EntityLinkParser.EOF, 0);
	};

	separator = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(SeparatorContext);
	    } else {
	        return this.getTypedRuleContext(SeparatorContext,i);
	    }
	};

	entity_type = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(Entity_typeContext);
	    } else {
	        return this.getTypedRuleContext(Entity_typeContext,i);
	    }
	};

	name_or_fqn = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(Name_or_fqnContext);
	    } else {
	        return this.getTypedRuleContext(Name_or_fqnContext,i);
	    }
	};

	entity_field = function(i) {
	    if(i===undefined) {
	        i = null;
	    }
	    if(i===null) {
	        return this.getTypedRuleContexts(Entity_fieldContext);
	    } else {
	        return this.getTypedRuleContext(Entity_fieldContext,i);
	    }
	};

	enterRule(listener) {
	    if(listener instanceof EntityLinkListener ) {
	        listener.enterEntitylink(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof EntityLinkListener ) {
	        listener.exitEntitylink(this);
		}
	}


}



class Entity_typeContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = EntityLinkParser.RULE_entity_type;
    }


	 
		copyFrom(ctx) {
			super.copyFrom(ctx);
		}

}


class EntityTypeContext extends Entity_typeContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	ENTITY_TYPE() {
	    return this.getToken(EntityLinkParser.ENTITY_TYPE, 0);
	};

	enterRule(listener) {
	    if(listener instanceof EntityLinkListener ) {
	        listener.enterEntityType(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof EntityLinkListener ) {
	        listener.exitEntityType(this);
		}
	}


}

EntityLinkParser.EntityTypeContext = EntityTypeContext;

class Name_or_fqnContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = EntityLinkParser.RULE_name_or_fqn;
    }


	 
		copyFrom(ctx) {
			super.copyFrom(ctx);
		}

}


class NameOrFQNContext extends Name_or_fqnContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	NAME_OR_FQN() {
	    return this.getToken(EntityLinkParser.NAME_OR_FQN, 0);
	};

	enterRule(listener) {
	    if(listener instanceof EntityLinkListener ) {
	        listener.enterNameOrFQN(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof EntityLinkListener ) {
	        listener.exitNameOrFQN(this);
		}
	}


}

EntityLinkParser.NameOrFQNContext = NameOrFQNContext;

class Entity_fieldContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = EntityLinkParser.RULE_entity_field;
    }


	 
		copyFrom(ctx) {
			super.copyFrom(ctx);
		}

}


class EntityFieldContext extends Entity_fieldContext {

    constructor(parser, ctx) {
        super(parser);
        super.copyFrom(ctx);
    }

	ENTITY_FIELD() {
	    return this.getToken(EntityLinkParser.ENTITY_FIELD, 0);
	};

	enterRule(listener) {
	    if(listener instanceof EntityLinkListener ) {
	        listener.enterEntityField(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof EntityLinkListener ) {
	        listener.exitEntityField(this);
		}
	}


}

EntityLinkParser.EntityFieldContext = EntityFieldContext;

class SeparatorContext extends antlr4.ParserRuleContext {

    constructor(parser, parent, invokingState) {
        if(parent===undefined) {
            parent = null;
        }
        if(invokingState===undefined || invokingState===null) {
            invokingState = -1;
        }
        super(parent, invokingState);
        this.parser = parser;
        this.ruleIndex = EntityLinkParser.RULE_separator;
    }


	enterRule(listener) {
	    if(listener instanceof EntityLinkListener ) {
	        listener.enterSeparator(this);
		}
	}

	exitRule(listener) {
	    if(listener instanceof EntityLinkListener ) {
	        listener.exitSeparator(this);
		}
	}


}




EntityLinkParser.EntitylinkContext = EntitylinkContext; 
EntityLinkParser.Entity_typeContext = Entity_typeContext; 
EntityLinkParser.Name_or_fqnContext = Name_or_fqnContext; 
EntityLinkParser.Entity_fieldContext = Entity_fieldContext; 
EntityLinkParser.SeparatorContext = SeparatorContext; 
