package org.openmetadata.service.governance.workflows.elements.triggers.impl;

import static org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer.OFFSET_EXTENSION;
import static org.openmetadata.service.governance.workflows.Workflow.ENTITY_LIST_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.PROCESSED_FQNS_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.TASK_RETRY_CONFIG;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;
import static org.openmetadata.service.governance.workflows.elements.triggers.PeriodicBatchEntityTrigger.HAS_FINISHED_VARIABLE;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.github.resilience4j.retry.Retry;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO.ChangeEventDAO.ChangeEventRecord;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchResultListMapper;
import org.openmetadata.service.search.SearchSortFilter;

@Slf4j
public class FetchChangeEventsImpl implements JavaDelegate {

  static final String CURRENT_BATCH_OFFSET_VARIABLE = "currentBatchOffset";
  static final String MAX_PROCESSED_OFFSET_VARIABLE = "maxProcessedOffset";
  static final int PROCESSED_FQNS_MAX_SIZE = 10_000;
  private static final String CARDINALITY_VARIABLE = "numberOfEntities";

  private static final Set<String> ENTITIES_NEEDING_KEYWORD_FQN =
      Set.of("testCase", "user", "team");

  private Expression entityTypesExpr;
  private Expression batchSizeExpr;
  private Expression workflowFqnExpr;
  private Expression searchFilterExpr;

  @Override
  public void execute(DelegateExecution execution) {
    String entityType = (String) entityTypesExpr.getValue(execution);
    int batchSize = Integer.parseInt((String) batchSizeExpr.getValue(execution));
    String workflowFqn = (String) workflowFqnExpr.getValue(execution);

    Retry retry = Retry.of("fetch-change-events", TASK_RETRY_CONFIG);

    long currentOffset = resolveStartingOffset(execution, workflowFqn, entityType, retry);

    List<ChangeEventRecord> records =
        Retry.decorateSupplier(
                retry,
                () ->
                    Entity.getCollectionDAO()
                        .changeEventDAO()
                        .listByEntityTypesWithOffset(List.of(entityType), currentOffset, batchSize))
            .get();

    if (records.isEmpty() && currentOffset > 0) {
      long minOffset =
          Retry.decorateSupplier(
                  retry,
                  () ->
                      Entity.getCollectionDAO()
                          .changeEventDAO()
                          .getMinOffsetForEntityTypes(List.of(entityType)))
              .get();
      if (minOffset > 0 && minOffset > currentOffset) {
        LOG.warn(
            "Workflow '{}' stored offset {} has been purged. Earliest available offset for entity type '{}' is {}. Resuming from there.",
            workflowFqn,
            currentOffset,
            entityType,
            minOffset);
        long resumeOffset = minOffset - 1;
        records =
            Retry.decorateSupplier(
                    retry,
                    () ->
                        Entity.getCollectionDAO()
                            .changeEventDAO()
                            .listByEntityTypesWithOffset(
                                List.of(entityType), resumeOffset, batchSize))
                .get();
      }
    }

    // Compute the max offset across all fetched records before any filtering.
    // This ensures the cursor always advances past a batch even when the search filter
    // removes all entities, preventing infinite re-processing of the same offset window.
    long batchMaxOffset = currentOffset;
    for (ChangeEventRecord record : records) {
      if (record.offset() > batchMaxOffset) {
        batchMaxOffset = record.offset();
      }
    }

    Map<String, Long> fqnToMaxOffset = deduplicateByFqn(records);

    LinkedHashMap<String, Boolean> processedFqns = loadProcessedFqns(execution);
    fqnToMaxOffset.keySet().removeAll(processedFqns.keySet());

    String searchFilter =
        Optional.ofNullable(searchFilterExpr)
            .map(expr -> (String) expr.getValue(execution))
            .orElse(null);

    if (searchFilter != null && !searchFilter.isBlank() && !fqnToMaxOffset.isEmpty()) {
      Set<String> matchingFqns =
          filterFqnsBySearchCriteria(
              new ArrayList<>(fqnToMaxOffset.keySet()), entityType, searchFilter);
      fqnToMaxOffset.entrySet().removeIf(e -> !matchingFqns.contains(e.getKey()));
    }

    for (String fqn : fqnToMaxOffset.keySet()) {
      processedFqns.put(fqn, Boolean.TRUE);
    }
    evictOverflow(processedFqns);

    List<String> entityList = new ArrayList<>();
    Map<String, List<String>> entityToListMap = new HashMap<>();
    for (String fqn : fqnToMaxOffset.keySet()) {
      String entityLink = new MessageParser.EntityLink(entityType, fqn).getLinkString();
      entityList.add(entityLink);
      entityToListMap.put(entityLink, List.of(entityLink));
    }

    execution.setVariable(PROCESSED_FQNS_VARIABLE, processedFqns);
    execution.setVariable(CURRENT_BATCH_OFFSET_VARIABLE, batchMaxOffset);

    Long existingMax = (Long) execution.getVariable(MAX_PROCESSED_OFFSET_VARIABLE);
    if (existingMax == null || batchMaxOffset > existingMax) {
      execution.setVariable(MAX_PROCESSED_OFFSET_VARIABLE, batchMaxOffset);
      CommitChangeEventOffsetImpl.commitOffset(workflowFqn, entityType, batchMaxOffset);
    }

    String updatedByVar = getNamespacedVariableName(GLOBAL_NAMESPACE, UPDATED_BY_VARIABLE);
    if (execution.getVariable(updatedByVar) == null) {
      execution.setVariable(updatedByVar, "governance-bot");
    }
    execution.setVariable(CARDINALITY_VARIABLE, entityList.size());
    execution.setVariable(HAS_FINISHED_VARIABLE, records.isEmpty());
    execution.setVariable(ENTITY_LIST_VARIABLE, entityList);
    execution.setVariable("entityToListMap", entityToListMap);
  }

  private long resolveStartingOffset(
      DelegateExecution execution, String workflowFqn, String entityType, Retry retry) {
    Object stored = execution.getVariable(CURRENT_BATCH_OFFSET_VARIABLE);
    if (stored != null) {
      return (Long) stored;
    }
    String consumerId = buildConsumerId(workflowFqn, entityType);
    String json =
        Entity.getCollectionDAO()
            .eventSubscriptionDAO()
            .getSubscriberExtension(consumerId, OFFSET_EXTENSION);
    if (json != null) {
      EventSubscriptionOffset offset = JsonUtils.readValue(json, EventSubscriptionOffset.class);
      return offset.getCurrentOffset();
    }
    long minOffset =
        Retry.decorateSupplier(
                retry,
                () ->
                    Entity.getCollectionDAO()
                        .changeEventDAO()
                        .getMinOffsetForEntityTypes(List.of(entityType)))
            .get();
    if (minOffset > 0) {
      LOG.info(
          "No stored offset for workflow '{}' entity type '{}'. Starting from earliest available offset {}.",
          workflowFqn,
          entityType,
          minOffset);
      return minOffset - 1;
    }
    return 0L;
  }

  private Map<String, Long> deduplicateByFqn(List<ChangeEventRecord> records) {
    Map<String, Long> fqnToMaxOffset = new LinkedHashMap<>();
    for (ChangeEventRecord record : records) {
      ChangeEvent event = JsonUtils.readValue(record.json(), ChangeEvent.class);
      String fqn = event.getEntityFullyQualifiedName();
      if (fqn == null || fqn.isEmpty()) {
        continue;
      }
      fqnToMaxOffset.merge(fqn, record.offset(), Math::max);
    }
    return fqnToMaxOffset;
  }

  private Set<String> filterFqnsBySearchCriteria(
      List<String> fqns, String entityType, String searchFilter) {
    String entitySpecificFilter = extractEntityFilter(searchFilter, entityType);
    if (entitySpecificFilter == null || entitySpecificFilter.isBlank()) {
      return new HashSet<>(fqns);
    }

    SearchRepository searchRepository = Entity.getSearchRepository();
    if (!searchRepository.checkIfIndexingIsSupported(entityType)) {
      return new HashSet<>(fqns);
    }

    try {
      String combinedFilter = buildCombinedFilter(fqns, entityType, entitySpecificFilter);
      String fqnField =
          ENTITIES_NEEDING_KEYWORD_FQN.contains(entityType)
              ? "fullyQualifiedName.keyword"
              : "fullyQualifiedName";
      SearchSortFilter sortFilter = new SearchSortFilter(fqnField, null, null, null);
      SearchResultListMapper result =
          searchRepository.listWithDeepPagination(
              entityType,
              null,
              combinedFilter,
              new String[] {"fullyQualifiedName"},
              sortFilter,
              fqns.size(),
              null);

      return result.getResults().stream()
          .map(r -> (String) r.get("fullyQualifiedName"))
          .filter(Objects::nonNull)
          .collect(Collectors.toSet());
    } catch (IOException e) {
      LOG.warn(
          "Failed to apply search filter for entity type '{}', processing all entities: {}",
          entityType,
          e.getMessage());
      return new HashSet<>(fqns);
    }
  }

  static String extractEntityFilter(String filterObj, String entityType) {
    if (filterObj == null || filterObj.isBlank()) {
      return null;
    }
    try {
      JsonNode node = JsonUtils.readTree(filterObj);
      if (!node.isObject()) {
        LOG.warn(
            "Filter for entity type '{}' is not a JSON object, ignoring: {}",
            entityType,
            filterObj);
        return null;
      }
      @SuppressWarnings("unchecked")
      Map<String, String> filterMap = JsonUtils.readValue(filterObj, Map.class);
      String filter = filterMap.get(entityType);
      if (filter != null && !filter.isBlank()) {
        return filter;
      }
      return filterMap.get("default");
    } catch (Exception e) {
      LOG.warn("Could not parse filter JSON for entity type '{}': {}", entityType, e.getMessage());
      return null;
    }
  }

  private String buildCombinedFilter(
      List<String> fqns, String entityType, String entitySpecificFilter) throws IOException {
    JsonNode entityFilterNode = JsonUtils.readTree(entitySpecificFilter);
    JsonNode configuredQuery = entityFilterNode.get("query");

    String fqnField =
        ENTITIES_NEEDING_KEYWORD_FQN.contains(entityType)
            ? "fullyQualifiedName.keyword"
            : "fullyQualifiedName";

    ArrayNode fqnArray = JsonUtils.getObjectMapper().createArrayNode();
    for (String fqn : fqns) {
      fqnArray.add(fqn);
    }
    ObjectNode termsNode = JsonUtils.getObjectMapper().createObjectNode();
    termsNode.set(fqnField, fqnArray);
    ObjectNode termsFilter = JsonUtils.getObjectMapper().createObjectNode();
    termsFilter.set("terms", termsNode);

    ArrayNode filterArray = JsonUtils.getObjectMapper().createArrayNode();
    if (configuredQuery != null) {
      filterArray.add(configuredQuery);
    }
    filterArray.add(termsFilter);

    ObjectNode boolNode = JsonUtils.getObjectMapper().createObjectNode();
    boolNode.set("filter", filterArray);

    ObjectNode queryNode = JsonUtils.getObjectMapper().createObjectNode();
    queryNode.set("bool", boolNode);

    ObjectNode result = JsonUtils.getObjectMapper().createObjectNode();
    result.set("query", queryNode);

    return JsonUtils.getObjectMapper().writeValueAsString(result);
  }

  static String buildConsumerId(String workflowFqn, String entityType) {
    if (workflowFqn == null || workflowFqn.isBlank()) {
      throw new IllegalArgumentException(
          "workflowFqn must not be null or blank when building consumer ID");
    }
    return workflowFqn + "Trigger-" + entityType;
  }

  @SuppressWarnings("unchecked")
  private LinkedHashMap<String, Boolean> loadProcessedFqns(DelegateExecution execution) {
    Object stored = execution.getVariable(PROCESSED_FQNS_VARIABLE);
    return stored instanceof LinkedHashMap
        ? (LinkedHashMap<String, Boolean>) stored
        : new LinkedHashMap<>();
  }

  private static void evictOverflow(LinkedHashMap<String, Boolean> cache) {
    int overflow = cache.size() - PROCESSED_FQNS_MAX_SIZE;
    if (overflow <= 0) {
      return;
    }
    Iterator<String> it = cache.keySet().iterator();
    for (int i = 0; i < overflow; i++) {
      it.next();
      it.remove();
    }
  }
}
