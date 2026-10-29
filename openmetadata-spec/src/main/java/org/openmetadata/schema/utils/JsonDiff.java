package org.openmetadata.schema.utils;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.utils.ArrayAlignment.Match;
import org.openmetadata.schema.utils.ArrayAlignment.Span;

/**
 * Computes the RFC 6902 patch that turns one JSON document into another. Objects are compared field
 * by field. Arrays skip the elements they share at the start and at the end. When the rest holds
 * elements with a unique identity, such as strings, columns or entity references, elements with the
 * same identity are paired ({@link ArrayAlignment}), so inserting, removing or moving an element
 * anywhere is one operation; elements left between pairs, and arrays without identities, are
 * compared position by position. Pairing by identity is kept only when it takes fewer operations
 * than pairing by position, so it never lengthens a patch, and the cost stays near linear in the
 * document where a general longest common subsequence diff turns quadratic on a wide array. An
 * addition is never folded into a {@code copy} or {@code move}, so every operation's {@code path}
 * names a location the patch changes, which is what patch authorization inspects.
 */
public final class JsonDiff {
  private static final String OP = "op";
  private static final String PATH = "path";
  private static final String VALUE = "value";
  private static final String ADD = "add";
  private static final String REMOVE = "remove";
  private static final String REPLACE = "replace";
  private static final String SEPARATOR = "/";
  private static final String TILDE = "~";
  private static final String ESCAPED_TILDE = "~0";
  private static final String ESCAPED_SEPARATOR = "~1";
  private static final Comparator<JsonNode> SCALAR_EQUALITY =
      (left, right) -> areEqualScalars(left, right) ? 0 : 1;

  private final ArrayNode operations = JsonNodeFactory.instance.arrayNode();
  private final boolean alignsArrays;

  private JsonDiff(final boolean alignsArrays) {
    this.alignsArrays = alignsArrays;
  }

  /**
   * Returns the RFC 6902 operations, as a JSON array, that turn {@code source} into {@code target}.
   */
  public static ArrayNode of(final JsonNode source, final JsonNode target) {
    final JsonDiff jsonDiff = new JsonDiff(true);
    jsonDiff.compare("", source, target);
    return jsonDiff.operations;
  }

  private void compare(final String path, final JsonNode source, final JsonNode target) {
    if (!source.equals(SCALAR_EQUALITY, target)) {
      compareChanged(path, source, target);
    }
  }

  private void compareChanged(final String path, final JsonNode source, final JsonNode target) {
    if (source.isObject() && target.isObject()) {
      compareObjects(path, source, target);
    } else if (source.isArray() && target.isArray()) {
      compareArrays(path, source, target);
    } else {
      addOperation(REPLACE, path, target);
    }
  }

  private void compareObjects(final String path, final JsonNode source, final JsonNode target) {
    removeFieldsMissingFrom(path, source, target);
    addFieldsMissingFrom(path, source, target);
    compareSharedFields(path, source, target);
  }

  private void removeFieldsMissingFrom(
      final String path, final JsonNode source, final JsonNode target) {
    for (final Map.Entry<String, JsonNode> field : source.properties()) {
      if (!target.has(field.getKey())) {
        addOperation(REMOVE, fieldPath(path, field.getKey()), null);
      }
    }
  }

  private void addFieldsMissingFrom(
      final String path, final JsonNode source, final JsonNode target) {
    for (final Map.Entry<String, JsonNode> field : target.properties()) {
      if (!source.has(field.getKey())) {
        addOperation(ADD, fieldPath(path, field.getKey()), field.getValue());
      }
    }
  }

  private void compareSharedFields(
      final String path, final JsonNode source, final JsonNode target) {
    for (final Map.Entry<String, JsonNode> field : source.properties()) {
      final JsonNode targetValue = target.get(field.getKey());
      if (targetValue != null) {
        compare(fieldPath(path, field.getKey()), field.getValue(), targetValue);
      }
    }
  }

  private void compareArrays(final String path, final JsonNode source, final JsonNode target) {
    final int prefix = sharedPrefix(source, target);
    final int suffix = sharedSuffix(source, target, prefix);
    final Span middle = new Span(prefix, source.size() - suffix, prefix, target.size() - suffix);
    final List<Match> matches =
        alignsArrays ? ArrayAlignment.match(source, target, middle) : List.of();
    if (shiftsElements(matches)) {
      compareShifted(path, source, target, middle, matches);
    } else {
      compareSpan(path, source, target, middle);
    }
  }

  /**
   * Keeps the patch that pairs elements by identity only when it is shorter than the one that pairs
   * them by position. The latter is built only when a lower bound of its length, which costs no
   * more than comparing the pairs, does not already exceed the former.
   */
  private void compareShifted(
      final String path,
      final JsonNode source,
      final JsonNode target,
      final Span middle,
      final List<Match> matches) {
    final JsonDiff aligned = new JsonDiff(true);
    aligned.compareMatched(path, source, target, middle, matches);
    ArrayNode shorter = aligned.operations;
    if (shorter.size() >= positionalLowerBound(source, target, middle)) {
      final JsonDiff positional = new JsonDiff(false);
      positional.compareSpan(path, source, target, middle);
      shorter = positional.operations.size() <= shorter.size() ? positional.operations : shorter;
    }
    operations.addAll(shorter);
  }

  /** Compares each matched pair in place, and the elements between pairs position by position. */
  private void compareMatched(
      final String path,
      final JsonNode source,
      final JsonNode target,
      final Span middle,
      final List<Match> matches) {
    int sourceFrom = middle.sourceFrom();
    int targetFrom = middle.targetFrom();
    for (final Match match : matches) {
      compareSpan(
          path, source, target, new Span(sourceFrom, match.source(), targetFrom, match.target()));
      compare(
          elementPath(path, match.target()),
          source.get(match.source()),
          target.get(match.target()));
      sourceFrom = match.source() + 1;
      targetFrom = match.target() + 1;
    }
    compareSpan(
        path,
        source,
        target,
        new Span(sourceFrom, middle.sourceTo(), targetFrom, middle.targetTo()));
  }

  /**
   * Pairs the elements of {@code span} position by position. The array already matches the target
   * before the span, so each target index is also where its element sits when the operation runs.
   */
  private void compareSpan(
      final String path, final JsonNode source, final JsonNode target, final Span span) {
    final int paired =
        Math.min(span.sourceTo() - span.sourceFrom(), span.targetTo() - span.targetFrom());
    for (int offset = 0; offset < paired; offset++) {
      final int targetIndex = span.targetFrom() + offset;
      compare(
          elementPath(path, targetIndex),
          source.get(span.sourceFrom() + offset),
          target.get(targetIndex));
    }
    // Each removal shifts the next unpaired element into the same index.
    for (int index = span.sourceFrom() + paired; index < span.sourceTo(); index++) {
      addOperation(REMOVE, elementPath(path, span.targetFrom() + paired), null);
    }
    for (int index = span.targetFrom() + paired; index < span.targetTo(); index++) {
      addOperation(ADD, elementPath(path, index), target.get(index));
    }
  }

  private static boolean shiftsElements(final List<Match> matches) {
    return matches.stream().anyMatch(match -> match.source() != match.target());
  }

  /** Each unequal pair and each unpaired element costs a positional patch an operation or more. */
  private static int positionalLowerBound(
      final JsonNode source, final JsonNode target, final Span span) {
    final int sourceLength = span.sourceTo() - span.sourceFrom();
    final int targetLength = span.targetTo() - span.targetFrom();
    int unequalPairs = 0;
    for (int offset = 0; offset < Math.min(sourceLength, targetLength); offset++) {
      final JsonNode sourceElement = source.get(span.sourceFrom() + offset);
      if (!sourceElement.equals(SCALAR_EQUALITY, target.get(span.targetFrom() + offset))) {
        unequalPairs++;
      }
    }
    return unequalPairs + Math.abs(sourceLength - targetLength);
  }

  private static int sharedPrefix(final JsonNode source, final JsonNode target) {
    final int limit = Math.min(source.size(), target.size());
    int prefix = 0;
    while (prefix < limit && source.get(prefix).equals(SCALAR_EQUALITY, target.get(prefix))) {
      prefix++;
    }
    return prefix;
  }

  /** Counts the equal trailing elements, never reaching into the shared prefix. */
  private static int sharedSuffix(final JsonNode source, final JsonNode target, final int prefix) {
    final int limit = Math.min(source.size(), target.size()) - prefix;
    int suffix = 0;
    while (suffix < limit && isEqualFromEnd(source, target, suffix)) {
      suffix++;
    }
    return suffix;
  }

  private static boolean isEqualFromEnd(
      final JsonNode source, final JsonNode target, final int offset) {
    final JsonNode sourceElement = source.get(source.size() - 1 - offset);
    return sourceElement.equals(SCALAR_EQUALITY, target.get(target.size() - 1 - offset));
  }

  private void addOperation(final String op, final String path, final JsonNode value) {
    final ObjectNode operation = operations.addObject();
    operation.put(OP, op);
    operation.put(PATH, path);
    if (value != null) {
      operation.set(VALUE, value);
    }
  }

  private static String elementPath(final String path, final int index) {
    return path + SEPARATOR + index;
  }

  private static String fieldPath(final String path, final String fieldName) {
    final String escaped =
        fieldName.replace(TILDE, ESCAPED_TILDE).replace(SEPARATOR, ESCAPED_SEPARATOR);
    return path + SEPARATOR + escaped;
  }

  /**
   * Numbers are equal when their values are, as RFC 6902 defines equality for {@code test}. Two
   * integers compare as Jackson nodes, the rule the java-json-tools diff applied, and so do NaN and
   * infinities, which have no decimal value.
   */
  private static boolean areEqualScalars(final JsonNode left, final JsonNode right) {
    final boolean bothIntegers = left.isIntegralNumber() && right.isIntegralNumber();
    final boolean comparesByValue =
        left.isNumber()
            && right.isNumber()
            && !bothIntegers
            && hasDecimalValue(left)
            && hasDecimalValue(right);
    return comparesByValue
        ? left.decimalValue().compareTo(right.decimalValue()) == 0
        : left.equals(right);
  }

  private static boolean hasDecimalValue(final JsonNode number) {
    final boolean binaryFloatingPoint = number.isDouble() || number.isFloat();
    return !binaryFloatingPoint || Double.isFinite(number.doubleValue());
  }
}
