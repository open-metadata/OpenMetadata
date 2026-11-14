/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.approval;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
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
import java.util.LinkedHashSet;
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
  private static final String RELATED_TERM = "term";
  private static final String RELATION_TYPE = "relationType";
  private static final String DEFAULT_RELATION_TYPE = "relatedTo";
  private static final String ENDPOINT = "endpoint";
  private static final String REFERENCE_NAME = "name";
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

  /**
   * The ops of two changes from one requester as one change. A later op on the same target wins,
   * except that a later field change over an earlier one is replayed onto the earlier value, so a
   * structured field such as {@code columns} keeps the edits of both.
   */
  public static List<MutationOp> merge(List<MutationOp> prior, List<MutationOp> next) {
    Map<String, MutationOp> byTarget = new LinkedHashMap<>();
    prior.forEach(op -> byTarget.put(targetOf(op), op));
    next.forEach(op -> byTarget.merge(targetOf(op), op, MutationPlanner::combine));
    return List.copyOf(byTarget.values());
  }

  /**
   * {@code ops} restated against the asset as published now: a field change whose base no longer
   * matches the published value takes that value as its base and has its own edits replayed onto
   * it, and one the asset already shows is left out.
   */
  public static List<MutationOp> rebase(JsonNode current, List<MutationOp> ops) {
    List<MutationOp> rebased = new ArrayList<>();
    for (MutationOp op : ops) {
      JsonNode published = orNull(current.get(op.getField()));
      JsonNode restated = replayed(op, published);
      if (!drifted(current, op)) {
        rebased.add(op);
      } else if (!sameValue(published, restated)) {
        rebased.add(
            JsonUtils.deepCopy(op, MutationOp.class)
                .withBaseValue(published.toString())
                .withValue(restated.toString()));
      }
    }
    return rebased;
  }

  private static MutationOp combine(MutationOp prior, MutationOp next) {
    boolean bothSet = prior.getOp() == MutationOpType.SET && next.getOp() == MutationOpType.SET;
    return bothSet
        ? JsonUtils.deepCopy(next, MutationOp.class)
            .withBaseValue(prior.getBaseValue())
            .withValue(replayed(next, valueOf(prior.getValue())).toString())
        : next;
  }

  /** The edits {@code op} makes to its base value, replayed onto {@code onto}. */
  private static JsonNode replayed(MutationOp op, JsonNode onto) {
    return threeWay(valueOf(op.getBaseValue()), onto, valueOf(op.getValue()));
  }

  private static JsonNode valueOf(String json) {
    return json == null ? NullNode.getInstance() : orNull(JsonUtils.readTree(json));
  }

  /**
   * {@code base} changed into both {@code ours} and {@code theirs}, as one value. Objects merge key
   * by key and lists whose elements all carry an identity or a name merge element by element, so
   * edits to different parts both survive. Wherever both sides changed the same part differently,
   * {@code theirs} wins. Parts are compared by content, so an edit to an element's other fields,
   * such as a tag label's state, counts as a change to that element.
   */
  static JsonNode threeWay(JsonNode base, JsonNode ours, JsonNode theirs) {
    JsonNode merged = theirs;
    if (sameContent(base, theirs)) {
      merged = ours;
    } else if (!sameContent(base, ours) && !sameContent(ours, theirs)) {
      merged = mergeBothChanged(base, ours, theirs);
    }
    return merged;
  }

  private static JsonNode mergeBothChanged(JsonNode base, JsonNode ours, JsonNode theirs) {
    JsonNode merged = theirs;
    boolean sameElement = Objects.equals(identityOf(ours), identityOf(theirs));
    if (ours.isObject() && theirs.isObject() && sameElement && (base.isObject() || base.isNull())) {
      merged = mergeObjects(base, ours, theirs);
    } else if (isNamedList(base) && isNamedList(ours) && isNamedList(theirs)) {
      merged = mergeLists(base, ours, theirs);
    }
    return merged;
  }

  private static ObjectNode mergeObjects(JsonNode base, JsonNode ours, JsonNode theirs) {
    ObjectNode merged = JsonNodeFactory.instance.objectNode();
    Set<String> keys = new LinkedHashSet<>();
    ours.fieldNames().forEachRemaining(keys::add);
    theirs.fieldNames().forEachRemaining(keys::add);
    for (String key : keys) {
      JsonNode value =
          threeWay(orNull(base.get(key)), orNull(ours.get(key)), orNull(theirs.get(key)));
      if (!value.isNull() || (ours.has(key) && theirs.has(key))) {
        merged.set(key, value);
      }
    }
    return merged;
  }

  /**
   * Element by element, in our order with their additions after. An element one side removed stays
   * removed, unless we removed it and they changed it.
   */
  private static ArrayNode mergeLists(JsonNode base, JsonNode ours, JsonNode theirs) {
    Map<String, JsonNode> baseByName = byName(base);
    Map<String, JsonNode> oursByName = byName(ours);
    Map<String, JsonNode> theirsByName = byName(theirs);
    Set<String> names = new LinkedHashSet<>(oursByName.keySet());
    names.addAll(theirsByName.keySet());
    ArrayNode merged = JsonNodeFactory.instance.arrayNode();
    for (String name : names) {
      JsonNode element =
          mergeElement(baseByName.get(name), oursByName.get(name), theirsByName.get(name));
      if (element != null) {
        merged.add(element);
      }
    }
    return merged;
  }

  /** One element as merged, or null when it is removed. */
  private static JsonNode mergeElement(JsonNode base, JsonNode ours, JsonNode theirs) {
    JsonNode element = null;
    if (ours != null && theirs != null) {
      element = threeWay(orNull(base), ours, theirs);
    } else if (base == null) {
      element = ours != null ? ours : theirs;
    } else if (theirs != null && !sameContent(base, theirs)) {
      element = theirs;
    }
    return element;
  }

  private static boolean isNamedList(JsonNode value) {
    boolean named = value.isNull() || value.isArray();
    for (JsonNode element : value) {
      named = named && nameOf(element) != null;
    }
    return named;
  }

  private static Map<String, JsonNode> byName(JsonNode list) {
    Map<String, JsonNode> byName = new LinkedHashMap<>();
    for (JsonNode element : list) {
      byName.put(nameOf(element), element);
    }
    return byName;
  }

  /** An element's identity, or else its name: a column has no identity but is unique by name. */
  private static String nameOf(JsonNode element) {
    String identity = identityOf(element);
    return identity != null || !element.path(REFERENCE_NAME).isTextual()
        ? identity
        : element.get(REFERENCE_NAME).asText();
  }

  public static boolean hasFieldChange(List<MutationOp> ops) {
    return ops.stream().anyMatch(op -> op.getOp() == MutationOpType.SET);
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

  private static boolean holdsOwn(JsonNode array, String key) {
    boolean held = false;
    for (JsonNode element : array) {
      held |= !element.path(INHERITED).asBoolean(false) && key.equals(identityOf(element));
    }
    return held;
  }

  private static int indexOf(JsonNode array, String key) {
    int found = -1;
    for (int i = 0; i < array.size() && found < 0; i++) {
      found = key.equals(identityOf(array.get(i))) ? i : -1;
    }
    return found;
  }

  /**
   * Whether the asset as published already shows what {@code op} proposes: the field holds the
   * proposed value, the element is there, or the removed element is gone. An element the asset only
   * inherits is not one it holds itself, so adding it is still a change.
   */
  public static boolean alreadyPublished(JsonNode current, MutationOp op) {
    JsonNode field = current.get(op.getField());
    boolean present = field != null && field.isArray() && holdsOwn(field, op.getKey());
    return switch (op.getOp()) {
      case SET -> sameValue(field, JsonUtils.readTree(op.getValue()));
      case ADD -> present;
      case REMOVE -> !present;
    };
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

  /**
   * The identity of a list element, so a change to a list is a set of element additions and
   * removals: a string is itself, a tag label its tag FQN, a relation to a glossary term that term
   * and the relation type, an external reference its endpoint and name, and an entity reference its id.
   * Elements of any other shape have no identity, and their list is replaced as a whole.
   */
  static String identityOf(JsonNode element) {
    String identity = null;
    if (element.isTextual()) {
      identity = element.asText();
    } else if (element.hasNonNull(TAG_FQN)) {
      identity = element.get(TAG_FQN).asText();
    } else if (element.path(RELATED_TERM).hasNonNull(REFERENCE_ID)) {
      identity =
          "%s|%s"
              .formatted(
                  element.get(RELATED_TERM).get(REFERENCE_ID).asText(),
                  element.path(RELATION_TYPE).asText(DEFAULT_RELATION_TYPE));
    } else if (element.hasNonNull(ENDPOINT)) {
      identity =
          "%s|%s".formatted(element.get(ENDPOINT).asText(), element.path(REFERENCE_NAME).asText());
    } else if (element.hasNonNull(REFERENCE_ID)) {
      identity = element.get(REFERENCE_ID).asText();
    }
    return identity;
  }

  private static boolean sameValue(JsonNode left, JsonNode right) {
    return Objects.equals(normalize(left), normalize(right));
  }

  private static boolean sameContent(JsonNode left, JsonNode right) {
    return orNull(left).equals(orNull(right));
  }

  private static JsonNode normalize(JsonNode value) {
    JsonNode normalized = orNull(value);
    String identity = normalized.isObject() ? identityOf(normalized) : null;
    return identity == null ? normalized : TextNode.valueOf(identity);
  }

  private static JsonNode orNull(JsonNode value) {
    return value == null || value.isMissingNode() ? NullNode.getInstance() : value;
  }

  /** The change an op makes, as reviewers name it: its field and, for an element, its key. */
  static String targetOf(MutationOp op) {
    return targetOf(op.getField(), op.getKey());
  }

  static String targetOf(String field, String key) {
    return "%s|%s".formatted(field, Objects.toString(key, ""));
  }

  private static MessageDigest sha256() {
    try {
      return MessageDigest.getInstance("SHA-256");
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 unavailable", e);
    }
  }
}
