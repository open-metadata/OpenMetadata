package org.openmetadata.service.notifications.template.handlebars.helpers;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Handlebars.SafeString;
import com.github.jknack.handlebars.Options;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelper;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperMetadata;
import org.openmetadata.service.notifications.template.handlebars.HandlebarsHelperUsage;

/**
 * Helper to generate inline text diff with add/remove markers.
 * Usage: {{textDiff oldValue newValue}}
 *
 * Produces HTML like: "This is <s>old</s> <b>new</b> text"
 */
public class TextDiffHelper implements HandlebarsHelper {

  private enum DiffType {
    EQUAL,
    INSERT,
    DELETE
  }

  private enum TokType {
    TAG,
    ENTITY,
    WS,
    WORD,
    OTHER
  }

  private record Token(TokType kind, String text) {
    @Override
    public @NotNull String toString() {
      return text;
    }
  }

  private record Diff(DiffType type, Token token) {}

  @Override
  public String getName() {
    return "textDiff";
  }

  @Override
  public void register(Handlebars handlebars) {
    handlebars.registerHelper(
        getName(),
        (context, options) -> {
          final String oldValue = context != null ? context.toString() : "";
          final String newValue =
              (options.params.length > 0 && options.param(0) != null)
                  ? options.param(0).toString()
                  : "";

          // Optional override of tags via hash, e.g. {{textDiff old new insTag="mark"
          // delTag="del"}}
          final String insTag = optTag(options, "insTag", "b");
          final String delTag = optTag(options, "delTag", "s");

          final String html =
              generateDiff(
                  oldValue,
                  newValue,
                  "<" + insTag + ">",
                  "</" + insTag + ">",
                  "<" + delTag + ">",
                  "</" + delTag + ">");

          return new SafeString(html);
        });
  }

  private static String optTag(Options options, String key, String defaultTag) {
    Object v = options.hash(key);
    if (v == null) return defaultTag;
    String s = v.toString().trim();
    // sanitize: allow simple tag names only (letters/digits and -)
    if (s.matches("[A-Za-z][A-Za-z0-9-]*")) return s;
    return defaultTag;
  }

  /**
   * Generates the diff HTML while preserving whitespace and not breaking tags.
   * Adds a space between a flushed delete block and the next insert block for readability.
   */
  private static String generateDiff(
      String oldValue,
      String newValue,
      String insertOpen,
      String insertClose,
      String deleteOpen,
      String deleteClose) {

    // Fast path: identical strings
    if (oldValue.equals(newValue)) {
      return newValue;
    }

    // Tokenize both sides: tags, entities, whitespace, words, and other symbols.
    List<Token> a = tokenizePreservingLayout(oldValue);
    List<Token> b = tokenizePreservingLayout(newValue);

    // Compute token diff with LCS (simple, robust, dependency-free)
    List<Diff> diffs = lcsDiff(a, b);

    // Render: group consecutive INSERT/DELETE runs that do NOT contain TAG tokens.
    StringBuilder out = new StringBuilder();

    // Buffers for grouping text runs; we never include TAG tokens inside these groups.
    StringBuilder insertRun = null;
    StringBuilder deleteRun = null;

    // If we just flushed a DELETE run, we may want a space before the next INSERT run,
    // unless that insert run already starts with whitespace.
    boolean needSpaceBeforeNextInsert = false;

    for (Diff d : diffs) {
      Token t = d.token;

      switch (d.type) {
        case EQUAL -> {
          // Flush any pending change runs first, then append as-is.
          if (deleteRun != null && !deleteRun.isEmpty()) {
            out.append(deleteOpen).append(deleteRun).append(deleteClose);
            deleteRun = null;
            needSpaceBeforeNextInsert = true; // consider spacing before a following insert
          }
          if (insertRun != null && !insertRun.isEmpty()) {
            // If we wanted a gap coming from a prior DELETE, add it before the insert block,
            // unless the insert already starts with whitespace.
            if (needSpaceBeforeNextInsert && !startsWithWhitespace(insertRun)) {
              out.append(" ");
            }
            out.append(insertOpen).append(insertRun).append(insertClose);
            insertRun = null;
            needSpaceBeforeNextInsert = false;
          }

          // Append equal token as-is.
          out.append(renderTokenVerbatim(t));

          // If equal token is whitespace, it already provides a gap.
          if (t.kind == TokType.WS) {
            needSpaceBeforeNextInsert = false;
          }
        }

        case INSERT -> {
          if (t.kind == TokType.TAG) {
            // Tags must not be wrapped. Flush runs and append tag verbatim.
            if (deleteRun != null && !deleteRun.isEmpty()) {
              out.append(deleteOpen).append(deleteRun).append(deleteClose);
              deleteRun = null;
              needSpaceBeforeNextInsert = true;
            }
            if (insertRun != null && !insertRun.isEmpty()) {
              if (needSpaceBeforeNextInsert && !startsWithWhitespace(insertRun)) {
                out.append(" ");
              }
              out.append(insertOpen).append(insertRun).append(insertClose);
              insertRun = null;
              needSpaceBeforeNextInsert = false;
            }
            // Do NOT add space before a tag; emit it directly.
            out.append(t.text);
          } else {
            // Part of a grouped insert run.
            if (insertRun == null) insertRun = new StringBuilder();
            insertRun.append(renderTokenVerbatim(t));
          }
        }

        case DELETE -> {
          if (t.kind == TokType.TAG) {
            // Skip deleted tags entirely (striking a tag would break HTML).
            // But do not merge across this boundary: flush any open runs.
            if (insertRun != null && !insertRun.isEmpty()) {
              if (needSpaceBeforeNextInsert && !startsWithWhitespace(insertRun)) {
                out.append(" ");
              }
              out.append(insertOpen).append(insertRun).append(insertClose);
              insertRun = null;
              needSpaceBeforeNextInsert = false;
            }
            if (deleteRun != null && !deleteRun.isEmpty()) {
              out.append(deleteOpen).append(deleteRun).append(deleteClose);
              deleteRun = null;
              needSpaceBeforeNextInsert = true;
            }
          } else {
            if (deleteRun == null) deleteRun = new StringBuilder();
            deleteRun.append(renderTokenVerbatim(t));
          }
        }
      }
    }

    // Flush any trailing runs.
    if (deleteRun != null && !deleteRun.isEmpty()) {
      out.append(deleteOpen).append(deleteRun).append(deleteClose);
      needSpaceBeforeNextInsert = true;
    }
    if (insertRun != null && !insertRun.isEmpty()) {
      if (needSpaceBeforeNextInsert && !startsWithWhitespace(insertRun)) {
        out.append(" ");
      }
      out.append(insertOpen).append(insertRun).append(insertClose);
    }

    return out.toString();
  }

  private static boolean startsWithWhitespace(StringBuilder sb) {
    return !sb.isEmpty() && Character.isWhitespace(sb.charAt(0));
  }

  /**
   * Tokenization that preserves layout and never synthesizes or drops characters.
   * Order of alternatives matters: tag | entity | whitespace | word | other
   */
  private static final Pattern TOKENIZER =
      Pattern.compile(
          "(?s)"
              + "(<[^>]+>)" // 1: HTML tag
              + "|(&[A-Za-z0-9#]+;)" // 2: HTML entity
              + "|(\\s+)" // 3: whitespace
              + "|([\\p{L}\\p{N}_]+)" // 4: word-ish (letters/digits/_)
              + "|([^\\p{L}\\p{N}\\s<>;&]+)" // 5: everything else (punctuation, symbols)
          );

  private static List<Token> tokenizePreservingLayout(String s) {
    List<Token> out = new ArrayList<>();
    if (s == null || s.isEmpty()) return out;
    Matcher m = TOKENIZER.matcher(s);
    int idx = 0;
    while (m.find()) {
      if (m.start() > idx) {
        // Unmatched slice (shouldn't happen, but preserve just in case)
        out.add(new Token(TokType.OTHER, s.substring(idx, m.start())));
      }
      String g1 = m.group(1), g2 = m.group(2), g3 = m.group(3), g4 = m.group(4), g5 = m.group(5);
      if (g1 != null) out.add(new Token(TokType.TAG, g1));
      else if (g2 != null) out.add(new Token(TokType.ENTITY, g2));
      else if (g3 != null) out.add(new Token(TokType.WS, g3));
      else if (g4 != null) out.add(new Token(TokType.WORD, g4));
      else out.add(new Token(TokType.OTHER, g5));
      idx = m.end();
    }
    if (idx < s.length()) {
      out.add(new Token(TokType.OTHER, s.substring(idx)));
    }
    return out;
  }

  /**
   * Basic LCS diff over tokens. O(N*M) time, O(N*M) memory.
   * For template-sized strings this is typically fine. If needed,
   * this can be swapped for a Myers/Hirschberg variant later
   * without changing the rest of the code.
   */
  private static List<Diff> lcsDiff(List<Token> a, List<Token> b) {
    final int n = a.size(), m = b.size();
    int[][] lcs = new int[n + 1][m + 1];
    for (int i = 1; i <= n; i++) {
      for (int j = 1; j <= m; j++) {
        if (a.get(i - 1).text.equals(b.get(j - 1).text)) {
          lcs[i][j] = lcs[i - 1][j - 1] + 1;
        } else {
          lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
        }
      }
    }
    List<Diff> out = new ArrayList<>();
    int i = n, j = m;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a.get(i - 1).text.equals(b.get(j - 1).text)) {
        out.addFirst(new Diff(DiffType.EQUAL, a.get(i - 1)));
        i--;
        j--;
      } else if (j > 0 && (i == 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
        out.addFirst(new Diff(DiffType.INSERT, b.get(j - 1)));
        j--;
      } else {
        out.addFirst(new Diff(DiffType.DELETE, a.get(i - 1)));
        i--;
      }
    }
    return out;
  }

  /**
   * Renders a token literally (no escaping required):
   *  - TAG and ENTITY are already HTML
   *  - WORD/OTHER/WS contain no '<' or bare '&' by construction of the tokenizer
   */
  private static String renderTokenVerbatim(Token t) {
    return t.text;
  }

  @Override
  public HandlebarsHelperMetadata getMetadata() {
    return new HandlebarsHelperMetadata()
        .withName("textDiff")
        .withDescription("Generate inline text diff with add/remove markers")
        .withCursorOffset(12)
        .withUsages(
            List.of(
                new HandlebarsHelperUsage()
                    .withSyntax("{{textDiff }}")
                    .withExample("{{textDiff entity.oldDescription entity.newDescription}}")));
  }
}
