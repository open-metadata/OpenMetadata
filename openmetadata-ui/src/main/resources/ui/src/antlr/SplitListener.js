import FqnListener from '../antlr/generated/FqnListener';

export default class SplitListener extends FqnListener {
  constructor() {
    super();
    this.xs = [];
  }

  // Enter a parse tree produced by FqnParser#unquotedName.
  enterUnquotedName(ctx) {
    this.xs.push(ctx.getText());
  }

  // Enter a parse tree produced by FqnParser#quotedName.
  enterQuotedName(ctx) {
    this.xs.push(ctx.getText());
  }

  split() {
    return this.xs;
  }
}
