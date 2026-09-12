package org.openmetadata.it.search;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Fetches whole search documents and diffs them, so a document produced by live indexing can be
 * compared against the same document rebuilt by a reindex.
 *
 * <p>Nothing in the codebase did this before: the closest existing check pulls a single named field
 * (see {@code ReindexDocSurvivalIT}), which cannot see drift in any field it was not told about.
 * Live indexing writes documents with hand-written painless, reindex writes them with the
 * declarative projector, and whether the two agree has never been asserted.
 *
 * <p>Two deliberate leniencies keep the diff signal-bearing rather than noisy, both of which trade
 * away real (but lower-value) coverage:
 *
 * <ul>
 *   <li><b>Arrays compare as multisets.</b> {@code tags[]}, {@code owners[]} and friends have no
 *       guaranteed order across the two paths, so ordering differences would swamp the output.
 *       Added, removed and changed elements are still caught; a pure reordering is not.
 *   <li><b>Absent, null and empty are equivalent.</b> One path omitting a field while the other
 *       writes null, {@code []} or <code>{}</code> is not a user-visible difference. The two paths
 *       genuinely disagree about materialising empty collections, and inconsistently in both
 *       directions ({@code user.personas} is {@code []} live and absent rebuilt; {@code
 *       messageSchema.schemaFields[].tags} is the reverse) — folding that in keeps the diff focused
 *       on semantic drift instead of shape noise that recurs on every entity type. A field that is
 *       empty on one side and populated on the other is still reported.
 * </ul>
 */
public final class DocumentParity {

  private DocumentParity() {}

  /** A single field-level disagreement between two documents. */
  public record Difference(String path, String live, String rebuilt) {
    @Override
    public String toString() {
      return String.format("%s: live=%s rebuilt=%s", path, live, rebuilt);
    }
  }

  /**
   * Returns the whole {@code _source} of the document with {@code id}, or a missing node when the
   * document is not in {@code index}.
   */
  public static JsonNode fetchSource(
      final SearchClient search, final String index, final String id) {
    final String query = "{\"query\":{\"term\":{\"id.keyword\":\"" + id + "\"}},\"size\":1}";
    final JsonNode hits = search.search(index, query).path("hits").path("hits");
    return hits.size() == 1 ? hits.get(0).path("_source") : hits.path(0).path("_source");
  }

  /** Every field where the two documents disagree, deepest path first. */
  public static List<Difference> diff(final JsonNode live, final JsonNode rebuilt) {
    final List<Difference> differences = new ArrayList<>();
    compare("", live, rebuilt, differences);
    return differences;
  }

  /** {@link #diff} with {@code ignoredPaths} removed from the result. */
  public static List<Difference> diffIgnoring(
      final JsonNode live, final JsonNode rebuilt, final Set<String> ignoredPaths) {
    return diff(live, rebuilt).stream()
        .filter(difference -> !ignoredPaths.contains(difference.path()))
        .toList();
  }

  private static void compare(
      final String path, final JsonNode live, final JsonNode rebuilt, final List<Difference> out) {
    if (isAbsent(live) && isAbsent(rebuilt)) {
      return;
    }
    if (live.isObject() && rebuilt.isObject()) {
      compareObjects(path, live, rebuilt, out);
    } else if (live.isArray() && rebuilt.isArray()) {
      compareArrays(path, live, rebuilt, out);
    } else if (!live.equals(rebuilt)) {
      out.add(new Difference(path.isEmpty() ? "<root>" : path, describe(live), describe(rebuilt)));
    }
  }

  private static void compareObjects(
      final String path, final JsonNode live, final JsonNode rebuilt, final List<Difference> out) {
    for (final String field : fieldUnion(live, rebuilt)) {
      compare(child(path, field), live.path(field), rebuilt.path(field), out);
    }
  }

  /**
   * Compares as multisets: elements are canonicalised and sorted before matching, so a difference is
   * reported only when an element is present on one side and not the other.
   */
  private static void compareArrays(
      final String path, final JsonNode live, final JsonNode rebuilt, final List<Difference> out) {
    final List<String> liveElements = canonicalElements(live);
    final List<String> rebuiltElements = canonicalElements(rebuilt);
    if (!liveElements.equals(rebuiltElements)) {
      out.add(
          new Difference(
              path.isEmpty() ? "<root>" : path,
              liveElements.toString(),
              rebuiltElements.toString()));
    }
  }

  private static List<String> canonicalElements(final JsonNode array) {
    final List<String> elements = new ArrayList<>();
    array.forEach(element -> elements.add(canonical(element)));
    elements.sort(Comparator.naturalOrder());
    return elements;
  }

  /**
   * Serialises a node with object keys sorted, so two elements carrying the same content in a
   * different key order compare equal. Jackson preserves insertion order, and the two write paths
   * build their maps in different orders — comparing raw {@code toString()} reports every such
   * element as changed, which buries real differences in noise.
   */
  private static String canonical(final JsonNode node) {
    final StringBuilder out = new StringBuilder();
    appendCanonical(node, out);
    return out.toString();
  }

  private static void appendCanonical(final JsonNode node, final StringBuilder out) {
    if (node.isObject()) {
      appendCanonicalObject(node, out);
    } else if (node.isArray()) {
      appendCanonicalArray(node, out);
    } else {
      out.append(node);
    }
  }

  /**
   * Carries-nothing fields are omitted so the canonical form obeys the same absent/null/empty
   * equivalence the object walk applies. Without this the two rules disagree for values nested
   * inside arrays — {@code messageSchema.schemaFields[].tags} is written as {@code []} by one path
   * and omitted by the other, which would be reported as a changed element.
   */
  private static void appendCanonicalObject(final JsonNode node, final StringBuilder out) {
    final List<String> fields = new ArrayList<>();
    node.fieldNames()
        .forEachRemaining(
            field -> {
              if (!isAbsent(node.path(field))) {
                fields.add(field);
              }
            });
    fields.sort(Comparator.naturalOrder());
    out.append('{');
    for (int i = 0; i < fields.size(); i++) {
      if (i > 0) {
        out.append(',');
      }
      out.append('"').append(fields.get(i)).append("\":");
      appendCanonical(node.path(fields.get(i)), out);
    }
    out.append('}');
  }

  /** Nested arrays are canonicalised element-wise but keep their order. */
  private static void appendCanonicalArray(final JsonNode node, final StringBuilder out) {
    out.append('[');
    for (int i = 0; i < node.size(); i++) {
      if (i > 0) {
        out.append(',');
      }
      appendCanonical(node.get(i), out);
    }
    out.append(']');
  }

  private static Set<String> fieldUnion(final JsonNode live, final JsonNode rebuilt) {
    final Set<String> fields = new LinkedHashSet<>();
    live.fieldNames().forEachRemaining(fields::add);
    rebuilt.fieldNames().forEachRemaining(fields::add);
    return fields;
  }

  /** Absent, null, {@code []} and <code>{}</code> all mean "this field carries nothing". */
  private static boolean isAbsent(final JsonNode node) {
    return node == null
        || node.isMissingNode()
        || node.isNull()
        || ((node.isArray() || node.isObject()) && node.isEmpty());
  }

  private static String child(final String path, final String field) {
    return path.isEmpty() ? field : path + "." + field;
  }

  private static String describe(final JsonNode node) {
    return isAbsent(node) ? "<absent>" : node.toString();
  }
}
