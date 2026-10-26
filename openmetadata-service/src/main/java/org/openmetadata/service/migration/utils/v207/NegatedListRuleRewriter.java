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

package org.openmetadata.service.migration.utils.v207;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;

// See ADR:2026-10-26-negated-list-conditions-are-stored-as-negated-some.
/**
 * Rewrites a JSON Logic rule the editor saved before the fix into the shape it saves now: a negated
 * condition on a list field ({@code some(tags, tagFQN != X)}, "has a tag other than X") becomes a
 * negation of the whole list ({@code !some(tags, tagFQN == X)}, "no tag is X"), which is what its
 * "Is Not" row always said. The same rewrite runs in the UI ({@code
 * utils/queryBuilder/jsonLogicNegation.ts}); both are tested against one case table, and applying
 * either to its own output changes nothing. Public so Collate's migration of the rules it stores
 * (reverse metadata filters) uses the same rewrite.
 */
@Slf4j
public final class NegatedListRuleRewriter {
  private static final String SOME = "some";
  private static final String NOT = "!";
  private static final String EQUALS = "==";
  private static final String NOT_EQUALS = "!=";
  private static final Set<String> CONJUNCTIONS = Set.of("and", "or");
  // Negations the editor can load back as a row; any other one inside a `some` keeps its shape.
  private static final Set<String> REVERSIBLE_NEGATIONS = Set.of("in", "contains");

  private NegatedListRuleRewriter() {}

  /** {@code rule} in the stored shape, or {@code rule} itself when nothing in it changes. */
  public static String rewrite(final String rule) {
    final Optional<JsonNode> parsed = parse(rule);
    final JsonNode rewritten = parsed.map(NegatedListRuleRewriter::rewriteNode).orElse(null);
    return rewritten == null || rewritten.equals(parsed.get()) ? rule : rewritten.toString();
  }

  // An explicit `!` is left as written: the editor offers no NOT, so one came through the API, and
  // a
  // per-element condition under it was meant per element.
  private static JsonNode rewriteNode(final JsonNode node) {
    final Map.Entry<String, JsonNode> entry = singleEntry(node);
    JsonNode rewritten = node;
    if (entry != null) {
      final Optional<JsonNode> negatedList = negateWholeList(entry);
      if (negatedList.isPresent()) {
        rewritten = negatedList.get();
      } else if (isConjunction(entry)) {
        rewritten = operation(entry.getKey(), rewriteEach((ArrayNode) entry.getValue()));
      }
    }
    return rewritten;
  }

  /** {@code !some(list, positive)} for a {@code some} whose condition negates one element. */
  private static Optional<JsonNode> negateWholeList(final Map.Entry<String, JsonNode> entry) {
    final JsonNode args = entry.getValue();
    final boolean isSome = SOME.equals(entry.getKey()) && isPair(args);
    return (isSome ? positiveOf(args.get(1)) : Optional.<JsonNode>empty())
        .map(positive -> operation(NOT, operation(SOME, pair(args.get(0), positive))));
  }

  /** The condition a per-element negation denies, for the shapes the editor writes. */
  private static Optional<JsonNode> positiveOf(final JsonNode condition) {
    final Map.Entry<String, JsonNode> entry = singleEntry(condition);
    final String operator = entry == null ? "" : entry.getKey();
    final JsonNode args = entry == null ? null : entry.getValue();
    Optional<JsonNode> positive = Optional.empty();
    if (NOT.equals(operator) && isReversibleNegation(args)) {
      positive = Optional.of(args);
    } else if (NOT_EQUALS.equals(operator) && comparesTo(args, false)) {
      positive = Optional.of(operation(EQUALS, args));
    } else if (EQUALS.equals(operator) && comparesTo(args, true)) {
      // "Is Not Set": `some(field == null)` never matches an empty list.
      positive = Optional.of(operation(NOT_EQUALS, args));
    }
    return positive;
  }

  private static boolean isReversibleNegation(final JsonNode negated) {
    final Map.Entry<String, JsonNode> entry = singleEntry(negated);
    return entry != null && REVERSIBLE_NEGATIONS.contains(entry.getKey());
  }

  private static boolean comparesTo(final JsonNode args, final boolean againstNull) {
    return isPair(args) && args.get(1).isNull() == againstNull;
  }

  private static boolean isConjunction(final Map.Entry<String, JsonNode> entry) {
    return CONJUNCTIONS.contains(entry.getKey()) && entry.getValue().isArray();
  }

  private static boolean isPair(final JsonNode args) {
    return args != null && args.isArray() && args.size() == 2;
  }

  private static ArrayNode rewriteEach(final ArrayNode children) {
    final ArrayNode rewritten = JsonNodeFactory.instance.arrayNode();
    children.forEach(child -> rewritten.add(rewriteNode(child)));
    return rewritten;
  }

  private static ArrayNode pair(final JsonNode first, final JsonNode second) {
    return JsonNodeFactory.instance.arrayNode().add(first).add(second);
  }

  private static ObjectNode operation(final String operator, final JsonNode args) {
    final ObjectNode operation = JsonNodeFactory.instance.objectNode();
    operation.set(operator, args);
    return operation;
  }

  private static Map.Entry<String, JsonNode> singleEntry(final JsonNode node) {
    final boolean isSingleOperation = node != null && node.isObject() && node.size() == 1;
    return isSingleOperation ? node.properties().iterator().next() : null;
  }

  private static Optional<JsonNode> parse(final String rule) {
    Optional<JsonNode> parsed = Optional.empty();
    if (!nullOrEmpty(rule)) {
      try {
        parsed = Optional.ofNullable(JsonUtils.readTree(rule));
      } catch (JsonParsingException e) {
        LOG.warn("Leaving a rule that is not JSON Logic unchanged: {}", e.getMessage());
      }
    }
    return parsed;
  }
}
