package org.openmetadata.service.governance.approval;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.NullNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.openmetadata.schema.governance.changeRequest.MutationOp;
import org.openmetadata.schema.governance.changeRequest.MutationOpType;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Pure computation of a change request's normalized operations over entity JSON trees. List fields
 * are diffed per element by stable identity (reference id, tag FQN or string value) so that a
 * concurrent unrelated element change never conflicts; other fields are replaced whole and compared
 * by normalized value, with reference objects compared by id.
 */
public final class MutationPlanner {
  private static final String REFERENCE_ID = "id";
  private static final String TAG_FQN = "tagFQN";
  private static final String INHERITED = "inherited";
  private static final Comparator<MutationOp> CANONICAL_ORDER =
      Comparator.comparing(MutationOp::getField)
          .thenComparing(op -> Objects.toString(op.getKey(), ""))
          .thenComparing(op -> op.getOp().value());

  public record ConflictSplit(
      List<MutationOp> applicable, List<MutationOp> gatedConflicts, List<MutationOp> dropped) {}

  private MutationPlanner() {}

  public static List<MutationOp> plan(
      JsonNode base, JsonNode proposed, Set<String> fields, Set<String> gatedFields) {
    List<MutationOp> ops = new ArrayList<>();
    for (String field : new TreeSet<>(fields)) {
      ops.addAll(
          planField(field, base.get(field), proposed.get(field), gatedFields.contains(field)));
    }
    return ops;
  }

  public static ObjectNode applyTo(JsonNode current, List<MutationOp> ops) {
    ObjectNode target = current.deepCopy();
    for (MutationOp op : ops) {
      applyOp(target, op);
    }
    return target;
  }

  public static ConflictSplit splitConflicts(JsonNode current, List<MutationOp> ops) {
    List<MutationOp> applicable = new ArrayList<>();
    List<MutationOp> gatedConflicts = new ArrayList<>();
    List<MutationOp> dropped = new ArrayList<>();
    for (MutationOp op : ops) {
      List<MutationOp> bucket = applicable;
      if (drifted(current, op)) {
        bucket = Boolean.FALSE.equals(op.getGated()) ? dropped : gatedConflicts;
      }
      bucket.add(op);
    }
    return new ConflictSplit(applicable, gatedConflicts, dropped);
  }

  public static List<MutationOp> merge(List<MutationOp> prior, List<MutationOp> next) {
    Map<String, MutationOp> byTarget = new LinkedHashMap<>();
    prior.forEach(op -> byTarget.put(targetOf(op), op));
    next.forEach(op -> byTarget.put(targetOf(op), op));
    return List.copyOf(byTarget.values());
  }

  public static String digest(List<MutationOp> ops) {
    List<MutationOp> canonical = ops.stream().sorted(CANONICAL_ORDER).toList();
    byte[] bytes = JsonUtils.pojoToJson(canonical).getBytes(StandardCharsets.UTF_8);
    return HexFormat.of().formatHex(sha256().digest(bytes));
  }

  /** True when base and proposed differ under the same identity rules the planner uses. */
  public static boolean differs(JsonNode base, JsonNode proposed) {
    return !planField("", base, proposed, false).isEmpty();
  }

  public static Set<String> fieldsOf(List<MutationOp> ops) {
    return ops.stream().map(MutationOp::getField).collect(Collectors.toCollection(TreeSet::new));
  }

  private static List<MutationOp> planField(
      String field, JsonNode baseValue, JsonNode proposedValue, boolean gated) {
    List<MutationOp> ops = List.of();
    if (isIdentityList(baseValue) && isIdentityList(proposedValue)) {
      ops = planListField(field, baseValue, proposedValue, gated);
    } else if (!sameValue(baseValue, proposedValue)) {
      ops = List.of(setOp(field, baseValue, proposedValue, gated));
    }
    return ops;
  }

  private static List<MutationOp> planListField(
      String field, JsonNode base, JsonNode proposed, boolean gated) {
    Map<String, JsonNode> baseByKey = byIdentity(base);
    Map<String, JsonNode> proposedByKey = byIdentity(proposed);
    List<MutationOp> ops = new ArrayList<>();
    proposedByKey.forEach(
        (key, element) ->
            addIfAbsent(ops, baseByKey, MutationOpType.ADD, field, key, element, gated));
    baseByKey.forEach(
        (key, element) ->
            addIfAbsent(ops, proposedByKey, MutationOpType.REMOVE, field, key, element, gated));
    return ops;
  }

  private static void addIfAbsent(
      List<MutationOp> ops,
      Map<String, JsonNode> other,
      MutationOpType type,
      String field,
      String key,
      JsonNode element,
      boolean gated) {
    if (!other.containsKey(key)) {
      ops.add(
          new MutationOp()
              .withOp(type)
              .withField(field)
              .withKey(key)
              .withValue(element.toString())
              .withGated(gated));
    }
  }

  private static MutationOp setOp(String field, JsonNode base, JsonNode proposed, boolean gated) {
    return new MutationOp()
        .withOp(MutationOpType.SET)
        .withField(field)
        .withBaseValue(orNull(base).toString())
        .withValue(orNull(proposed).toString())
        .withGated(gated);
  }

  private static void applyOp(ObjectNode target, MutationOp op) {
    switch (op.getOp()) {
      case SET -> applySet(target, op);
      case ADD -> addElement(target, op);
      case REMOVE -> removeElement(target, op);
    }
  }

  private static void applySet(ObjectNode target, MutationOp op) {
    JsonNode value = JsonUtils.readTree(op.getValue());
    if (value.isNull()) {
      target.remove(op.getField());
    } else {
      target.set(op.getField(), value);
    }
  }

  private static void addElement(ObjectNode target, MutationOp op) {
    JsonNode existing = target.get(op.getField());
    ArrayNode array =
        existing != null && existing.isArray()
            ? (ArrayNode) existing
            : target.putArray(op.getField());
    if (indexOf(array, op.getKey()) < 0) {
      array.add(JsonUtils.readTree(op.getValue()));
    }
  }

  private static void removeElement(ObjectNode target, MutationOp op) {
    JsonNode existing = target.get(op.getField());
    if (existing != null && existing.isArray()) {
      int index = indexOf(existing, op.getKey());
      if (index >= 0) {
        ((ArrayNode) existing).remove(index);
      }
    }
  }

  private static int indexOf(JsonNode array, String key) {
    int found = -1;
    for (int i = 0; i < array.size() && found < 0; i++) {
      found = key.equals(identityOf(array.get(i))) ? i : -1;
    }
    return found;
  }

  private static boolean drifted(JsonNode current, MutationOp op) {
    return op.getOp() == MutationOpType.SET
        && !sameValue(current.get(op.getField()), JsonUtils.readTree(op.getBaseValue()));
  }

  private static boolean isIdentityList(JsonNode value) {
    boolean identityList = value == null || value.isNull() || value.isArray();
    if (value != null && value.isArray()) {
      for (JsonNode element : value) {
        identityList = identityList && identityOf(element) != null;
      }
    }
    return identityList;
  }

  private static Map<String, JsonNode> byIdentity(JsonNode list) {
    Map<String, JsonNode> byKey = new LinkedHashMap<>();
    if (list != null && list.isArray()) {
      for (JsonNode element : list) {
        if (!element.path(INHERITED).asBoolean(false)) {
          byKey.put(identityOf(element), element);
        }
      }
    }
    return byKey;
  }

  static String identityOf(JsonNode element) {
    String identity = null;
    if (element.isTextual()) {
      identity = element.asText();
    } else if (element.hasNonNull(TAG_FQN)) {
      identity = element.get(TAG_FQN).asText();
    } else if (element.hasNonNull(REFERENCE_ID)) {
      identity = element.get(REFERENCE_ID).asText();
    }
    return identity;
  }

  private static boolean sameValue(JsonNode left, JsonNode right) {
    return Objects.equals(normalize(left), normalize(right));
  }

  private static JsonNode normalize(JsonNode value) {
    JsonNode normalized = orNull(value);
    String identity = normalized.isObject() ? identityOf(normalized) : null;
    return identity == null ? normalized : TextNode.valueOf(identity);
  }

  private static JsonNode orNull(JsonNode value) {
    return value == null || value.isMissingNode() ? NullNode.getInstance() : value;
  }

  private static String targetOf(MutationOp op) {
    return "%s|%s".formatted(op.getField(), Objects.toString(op.getKey(), ""));
  }

  private static MessageDigest sha256() {
    try {
      return MessageDigest.getInstance("SHA-256");
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 unavailable", e);
    }
  }
}
