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

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
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
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.util.EntityUtil;

/**
 * Stores every saved JSON Logic rule in the shape {@link NegatedListRuleRewriter} describes, so a
 * rule runs as its row reads from the upgrade on instead of changing the next time someone saves
 * it. Covers what the 2.0 editor saves: workflow check conditions and event trigger filters, data
 * contract semantics and the entity rules settings. Idempotent.
 */
@Slf4j
public final class NegatedListRuleMigration {
  public static final String WORKFLOW_STEP = "negatedListRulesInWorkflows";
  public static final String DATA_CONTRACT_STEP = "negatedListRulesInDataContracts";
  public static final String ENTITY_RULES_STEP = "negatedListRulesInEntityRules";
  private static final int BATCH_SIZE = 1_000;
  private static final String CHECK_CONDITION = "checkEntityAttributesTask";
  private static final String EVENT_TRIGGER = "eventBasedEntity";
  private static final String CONFIG = "config";
  private static final String FILTER = "filter";
  private static final String RULES = "rules";
  private static final String RULE = "rule";
  private static final String SEMANTICS = "semantics";

  private NegatedListRuleMigration() {}

  /** A string field of a stored definition that holds one JSON Logic rule. */
  record RuleField(ObjectNode holder, String field) {
    String rule() {
      return holder.path(field).asText();
    }

    boolean rewrite() {
      final String rewritten = NegatedListRuleRewriter.rewrite(rule());
      final boolean changed = !rewritten.equals(rule());
      if (changed) {
        holder.put(field, rewritten);
      }
      return changed;
    }
  }

  /**
   * Needs the WorkflowHandler initialized: storing a definition also deploys it, and only a
   * redeployed workflow runs its new rules. Fails after trying every workflow, so a failed deploy
   * leaves the step unrecorded for the next run to retry.
   */
  public static void rewriteWorkflowRules() {
    final WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    final List<String> failed = new ArrayList<>();
    for (final WorkflowDefinition stored :
        repository.listAll(EntityUtil.Fields.EMPTY_FIELDS, new ListFilter())) {
      try {
        rewriteAndRedeploy(repository, stored);
      } catch (RuntimeException e) {
        // Flowable reports a failed deploy with its own unchecked exceptions; the rest still run.
        LOG.error("[v207] Failed to rewrite workflow '{}'", stored.getName(), e);
        failed.add(stored.getName());
      }
    }
    if (!failed.isEmpty()) {
      throw new IllegalStateException(
          "Workflows %s kept their rules undeployed; run the migration again".formatted(failed));
    }
  }

  /**
   * A definition already in the new shape is deployed again: a run interrupted after storing it,
   * before deploying it, left Flowable on the old rules, and nothing left to rewrite says so.
   */
  public static void rewriteAndRedeploy(
      final WorkflowDefinitionRepository repository, final WorkflowDefinition stored) {
    final ObjectNode definition = (ObjectNode) JsonUtils.valueToTree(stored);
    if (rewriteWorkflow(definition)) {
      repository.createOrUpdate(
          null, JsonUtils.treeToValue(definition, WorkflowDefinition.class), ADMIN_USER_NAME);
      LOG.info("[v207] Rewrote and redeployed the negated list rules of '{}'", stored.getName());
    } else if (hasNegatedList(definition)) {
      WorkflowHandler.getInstance().deploy(new Workflow(stored));
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

  static boolean hasNegatedList(final ObjectNode definition) {
    final ObjectNode decoded = definition.deepCopy();
    decodeStringFilter(decoded);
    return workflowRules(decoded).stream()
        .anyMatch(field -> NegatedListRuleRewriter.hasNegatedList(field.rule()));
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
        LOG.warn("[v207] Leaving a trigger filter that is not JSON unchanged: {}", e.getMessage());
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
    LOG.info("[v207] Rewrote the negated list rules of {} data contract(s)", rewritten);
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
        LOG.info("[v207] Rewrote the negated list rules of the entity rules settings");
      }
    }
  }

  static boolean rewriteEntityRules(final EntityRulesSettings rules) {
    boolean changed = false;
    for (final SemanticsRule semantic : rules.getEntitySemantics()) {
      final String rewritten = NegatedListRuleRewriter.rewrite(semantic.getRule());
      if (rewritten != null && !rewritten.equals(semantic.getRule())) {
        semantic.setRule(rewritten);
        changed = true;
      }
    }
    return changed;
  }
}
