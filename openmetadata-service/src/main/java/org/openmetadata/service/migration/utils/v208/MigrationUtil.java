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

package org.openmetadata.service.migration.utils.v208;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.util.EntityUtil;

// See ADR:2026-10-26-negated-list-conditions-are-stored-as-negated-some.
/**
 * 2.0.8 data migration: rewrites saved JSON Logic rules whose list condition was negated per
 * element into the shape the rule editor saves now, so each rule runs as its row reads from the
 * upgrade on instead of changing the next time someone saves it.
 */
@Slf4j
public final class MigrationUtil {

  private MigrationUtil() {}

  // Stores every saved JSON Logic rule in the shape `rewriteNegatedListRule` produces, so a
  // rule runs as its row reads from the upgrade on instead of changing the next time someone saves
  // it. Covers what the 2.0 editor saves: workflow check conditions and event trigger filters, data
  // contract semantics and the entity rules settings. Idempotent.

  public static final String NEGATED_LIST_WORKFLOW_STEP = "negatedListRulesInWorkflows";
  public static final String NEGATED_LIST_DATA_CONTRACT_STEP = "negatedListRulesInDataContracts";
  public static final String NEGATED_LIST_ENTITY_RULES_STEP = "negatedListRulesInEntityRules";
  private static final int BATCH_SIZE = 1_000;
  private static final String CHECK_CONDITION = "checkEntityAttributesTask";
  private static final String EVENT_TRIGGER = "eventBasedEntity";
  private static final String CONFIG = "config";
  private static final String FILTER = "filter";
  private static final String RULES = "rules";
  private static final String RULE = "rule";
  private static final String SEMANTICS = "semantics";

  /** A string field of a stored definition that holds one JSON Logic rule. */
  record RuleField(ObjectNode holder, String field) {
    String rule() {
      return holder.path(field).asText();
    }

    boolean rewrite() {
      final String rewritten = rewriteNegatedListRule(rule());
      final boolean changed = !rewritten.equals(rule());
      if (changed) {
        holder.put(field, rewritten);
      }
      return changed;
    }
  }

  /**
   * Needs the WorkflowHandler initialized: storing a definition also deploys it, and only a
   * redeployed workflow runs its new rules. A workflow that fails is logged and the rest still run,
   * as earlier workflow migrations do, so one undeployable workflow does not block the upgrade.
   */
  public static void rewriteWorkflowRules() {
    final WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    for (final WorkflowDefinition stored :
        repository.listAll(EntityUtil.Fields.EMPTY_FIELDS, new ListFilter())) {
      try {
        rewriteAndRedeploy(repository, stored);
      } catch (RuntimeException e) {
        // Flowable reports a failed deploy with its own unchecked exceptions.
        LOG.error(
            "[v208] Failed to rewrite workflow '{}'; save it again to apply the corrected rules",
            stored.getName(),
            e);
      }
    }
  }

  public static void rewriteAndRedeploy(
      final WorkflowDefinitionRepository repository, final WorkflowDefinition stored) {
    final ObjectNode definition = (ObjectNode) JsonUtils.valueToTree(stored);
    if (rewriteWorkflow(definition)) {
      repository.createOrUpdate(
          null, JsonUtils.treeToValue(definition, WorkflowDefinition.class), ADMIN_USER_NAME);
      LOG.info("[v208] Rewrote and redeployed the negated list rules of '{}'", stored.getName());
    }
  }

  static boolean rewriteWorkflow(final ObjectNode definition) {
    final Optional<ObjectNode> encodedFilter = decodeStringFilter(definition);
    boolean changed = false;
    for (final RuleField field : workflowRules(definition)) {
      changed |= field.rewrite();
    }
    encodedFilter.ifPresent(config -> config.put(FILTER, config.path(FILTER).toString()));
    return changed;
  }

  static List<RuleField> workflowRules(final ObjectNode definition) {
    final List<RuleField> fields = new ArrayList<>();
    for (final JsonNode node : definition.path("nodes")) {
      if (CHECK_CONDITION.equals(node.path("subType").asText())) {
        addTextField(fields, node.path(CONFIG), RULES);
      }
    }
    final JsonNode filter = eventTriggerConfig(definition).path(FILTER);
    filter.fieldNames().forEachRemaining(entityType -> addTextField(fields, filter, entityType));
    return fields;
  }

  private static JsonNode eventTriggerConfig(final JsonNode definition) {
    final JsonNode trigger = definition.path("trigger");
    return EVENT_TRIGGER.equals(trigger.path("type").asText())
        ? trigger.path(CONFIG)
        : MissingNode.getInstance();
  }

  /**
   * A filter stored as a string is a JSON-encoded map of entity type to rule, the only string form
   * the trigger reads; it is decoded in place so its rules are rewritten like a map's, and the
   * returned config is where to encode it again.
   */
  private static Optional<ObjectNode> decodeStringFilter(final ObjectNode definition) {
    final JsonNode config = eventTriggerConfig(definition);
    final JsonNode filter = config.path(FILTER);
    Optional<ObjectNode> decodedIn = Optional.empty();
    if (filter.isTextual()) {
      try {
        final JsonNode map = JsonUtils.readTree(filter.asText());
        if (map != null && map.isObject()) {
          ((ObjectNode) config).set(FILTER, map);
          decodedIn = Optional.of((ObjectNode) config);
        }
      } catch (JsonParsingException e) {
        LOG.warn("[v208] Leaving a trigger filter that is not JSON unchanged: {}", e.getMessage());
      }
    }
    return decodedIn;
  }

  private static void addTextField(
      final List<RuleField> fields, final JsonNode holder, final String field) {
    if (holder.isObject() && holder.path(field).isTextual()) {
      fields.add(new RuleField((ObjectNode) holder, field));
    }
  }

  public static void rewriteDataContractRules(final CollectionDAO collectionDAO) {
    rewriteDataContractRules(collectionDAO.dataContractDAO());
  }

  static int rewriteDataContractRules(final EntityDAO<?> contractDAO) {
    int rewritten = 0;
    List<String> batch = nextBatch(contractDAO, "", "");
    while (!batch.isEmpty()) {
      for (final String json : batch) {
        rewritten += rewriteAndStore(contractDAO, json);
      }
      final JsonNode last = JsonUtils.readTree(batch.getLast());
      batch = nextBatch(contractDAO, last.path("name").asText(), last.path("id").asText());
    }
    LOG.info("[v208] Rewrote the negated list rules of {} data contract(s)", rewritten);
    return rewritten;
  }

  private static List<String> nextBatch(
      final EntityDAO<?> contractDAO, final String afterName, final String afterId) {
    return contractDAO.listAfter(new ListFilter(Include.ALL), BATCH_SIZE, afterName, afterId);
  }

  /** Only a contract with a list condition is parsed, so a catalog of plain contracts stays cheap. */
  public static int rewriteAndStore(final EntityDAO<?> contractDAO, final String json) {
    final ObjectNode contract =
        json.contains("some") ? (ObjectNode) JsonUtils.readTree(json) : null;
    final boolean changed = contract != null && rewriteSemantics(contract);
    if (changed) {
      contractDAO.update(
          UUID.fromString(contract.path("id").asText()),
          contract.path("fullyQualifiedName").asText(),
          contract.toString());
    }
    return changed ? 1 : 0;
  }

  static boolean rewriteSemantics(final ObjectNode contract) {
    boolean changed = false;
    for (final JsonNode semantic : contract.path(SEMANTICS)) {
      final List<RuleField> fields = new ArrayList<>();
      addTextField(fields, semantic, RULE);
      for (final RuleField field : fields) {
        changed |= field.rewrite();
      }
    }
    return changed;
  }

  public static void rewriteEntityRules() {
    final SystemRepository systemRepository = Entity.getSystemRepository();
    final Settings settings =
        systemRepository == null
            ? null
            : systemRepository.getConfigWithKey(SettingsType.ENTITY_RULES_SETTINGS.toString());
    if (settings != null && settings.getConfigValue() != null) {
      final EntityRulesSettings rules =
          JsonUtils.readValue(
              JsonUtils.pojoToJson(settings.getConfigValue()), EntityRulesSettings.class);
      if (rewriteEntityRules(rules)) {
        settings.setConfigValue(rules);
        systemRepository.updateSetting(settings);
        LOG.info("[v208] Rewrote the negated list rules of the entity rules settings");
      }
    }
  }

  static boolean rewriteEntityRules(final EntityRulesSettings rules) {
    boolean changed = false;
    for (final SemanticsRule semantic : rules.getEntitySemantics()) {
      final String rewritten = rewriteNegatedListRule(semantic.getRule());
      if (rewritten != null && !rewritten.equals(semantic.getRule())) {
        semantic.setRule(rewritten);
        changed = true;
      }
    }
    return changed;
  }

  // See ADR:2026-10-26-negated-list-conditions-are-stored-as-negated-some.
  // Rewrites a JSON Logic rule the editor saved before the fix into the shape it saves now: a
  // negated condition on a list field (`some(tags, tagFQN != X)`, "has a tag other than X") becomes
  // a negation of the whole list (`!some(tags, tagFQN == X)`, "no tag is X"), which is what its
  // "Is Not" row always said. The UI runs the same rewrite (jsonLogicNegation.ts); both are tested
  // against one case table, and applying either to its own output changes nothing.
  // Public so Collate rewrites the rules it stores (reverse metadata filters) the same way.

  private static final String SOME = "some";
  private static final String NOT = "!";
  private static final String EQUALS = "==";
  private static final String NOT_EQUALS = "!=";
  private static final Set<String> CONJUNCTIONS = Set.of("and", "or");
  // Negations the editor can load back as a row; any other one inside a `some` keeps its shape.
  private static final Set<String> REVERSIBLE_NEGATIONS = Set.of("in", "contains");

  /** {@code rule} in the stored shape, or {@code rule} itself when nothing in it changes. */
  public static String rewriteNegatedListRule(final String rule) {
    final Optional<JsonNode> parsed = parse(rule);
    final JsonNode rewritten = parsed.map(MigrationUtil::rewriteNode).orElse(null);
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
