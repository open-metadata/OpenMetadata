package org.openmetadata.service.alerting.content.template.sandbox;

import com.github.jknack.handlebars.internal.HbsLexer;
import com.github.jknack.handlebars.internal.antlr.CharStreams;
import com.github.jknack.handlebars.internal.antlr.Token;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Finds the constructs a template may not use, from the tokens of the Handlebars lexer itself, so
 * the check reads a template exactly as the engine will. Delimiter changes are refused because the
 * lexer keeps reading with the default delimiters after one.
 */
final class TemplateConstructScanner {

  private static final Map<Integer, String> UNSUPPORTED_TOKENS =
      Map.of(
          HbsLexer.START_PARTIAL, "Partials",
          HbsLexer.START_PARTIAL_BLOCK, "Partial blocks",
          HbsLexer.DECORATOR, "Decorators",
          HbsLexer.START_DELIM, "Custom delimiters",
          HbsLexer.START_RAW, "Raw blocks");

  private static final Set<Integer> TAG_OPENERS =
      Set.of(
          HbsLexer.START,
          HbsLexer.START_AMP,
          HbsLexer.START_T,
          HbsLexer.START_BLOCK,
          HbsLexer.UNLESS);

  private static final Set<Integer> TAG_CLOSERS = Set.of(HbsLexer.END, HbsLexer.END_T, HbsLexer.RP);

  private final Set<String> helperNames;

  TemplateConstructScanner(Set<String> helperNames) {
    this.helperNames = helperNames;
  }

  void requireSupported(String template) {
    List<? extends Token> tokens = tokensOf(template);
    for (int index = 0; index < tokens.size(); index++) {
      requireSupportedToken(tokens.get(index));
      requireAvailableHelper(tokens, index);
    }
  }

  private static List<? extends Token> tokensOf(String template) {
    HbsLexer lexer = new HbsLexer(CharStreams.fromString(template), "{{", "}}");
    lexer.removeErrorListeners();
    return lexer.getAllTokens();
  }

  private static void requireSupportedToken(Token token) {
    String construct = UNSUPPORTED_TOKENS.get(token.getType());
    if (construct != null) {
      throw refused("%s are not supported in notification templates", construct, token);
    }
  }

  // A tag whose name is followed by arguments, and every sub-expression, calls a helper; a name
  // standing alone may also be a data path, which is always allowed.
  private void requireAvailableHelper(List<? extends Token> tokens, int index) {
    int nameIndex = helperNameIndex(tokens, index);
    boolean isCall = nameIndex > 0 && isHelperCall(tokens, index, nameIndex);
    if (isCall && !helperNames.contains(tokens.get(nameIndex).getText())) {
      throw refused(
          "Helper '%s' is not available in notification templates",
          tokens.get(nameIndex).getText(), tokens.get(nameIndex));
    }
  }

  private static int helperNameIndex(List<? extends Token> tokens, int index) {
    int type = tokens.get(index).getType();
    boolean opensCall = TAG_OPENERS.contains(type) || type == HbsLexer.LP;
    int nameIndex = index + 1;
    if (opensCall && hasType(tokens, nameIndex, HbsLexer.ELSE)) {
      nameIndex++;
    }
    return opensCall && hasType(tokens, nameIndex, HbsLexer.QID) ? nameIndex : -1;
  }

  private static boolean isHelperCall(List<? extends Token> tokens, int index, int nameIndex) {
    boolean isSubExpression = tokens.get(index).getType() == HbsLexer.LP;
    int next = nameIndex + 1;
    boolean hasArguments =
        next < tokens.size() && !TAG_CLOSERS.contains(tokens.get(next).getType());
    return isSubExpression || hasArguments;
  }

  private static boolean hasType(List<? extends Token> tokens, int index, int type) {
    return index < tokens.size() && tokens.get(index).getType() == type;
  }

  private static TemplateRefusedException refused(String format, String subject, Token token) {
    return new TemplateRefusedException(
        String.format(format, subject) + String.format(" (line %d)", token.getLine()));
  }
}
