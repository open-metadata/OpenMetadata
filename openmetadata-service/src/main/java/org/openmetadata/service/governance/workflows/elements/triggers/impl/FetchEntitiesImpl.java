package org.openmetadata.service.governance.workflows.elements.triggers.impl;

import static org.openmetadata.service.governance.workflows.elements.triggers.PeriodicBatchEntityTrigger.CARDINALITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.elements.triggers.PeriodicBatchEntityTrigger.COLLECTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.elements.triggers.PeriodicBatchEntityTrigger.HAS_FINISHED_VARIABLE;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchResultListMapper;
import org.openmetadata.service.search.SearchSortFilter;

@Slf4j
public class FetchEntitiesImpl implements JavaDelegate {
  private Expression entityTypesExpr;
  private Expression searchFilterExpr;
  private Expression batchSizeExpr;

  @Override
  public void execute(DelegateExecution execution) {
    // Extract the entity type from the process definition key
    // PeriodicBatchEntityTrigger creates processes like: triggerWorkflowId-Table,
    // triggerWorkflowId-Dashboard
    String processDefinitionKey = execution.getProcessDefinitionId().split(":")[0];
    String entityTypeToFetch = null;

    // Check if this is a PeriodicBatchEntityTrigger process (contains hyphen with entity type
    // suffix)
    if (processDefinitionKey.contains("-")) {
      // Extract entity type from process key (e.g., "workflowTrigger-Table" -> "Table")
      String[] parts = processDefinitionKey.split("-");
      if (parts.length >= 2) {
        entityTypeToFetch = parts[parts.length - 1]; // Get the last part after hyphen
        LOG.debug(
            "Extracted entity type '{}' from process key '{}'",
            entityTypeToFetch,
            processDefinitionKey);
      }
    }

    // If we couldn't extract from process key, this might be a non-batch trigger
    // For non-batch triggers, we can use the configured entity types
    if (entityTypeToFetch == null) {
      // This is likely NOT a PeriodicBatchEntityTrigger, so we can process all configured types
      // Handle both legacy entityType (string) and new entityTypes (array) for backward
      // compatibility
      Object entityTypesValue = entityTypesExpr.getValue(execution);
      List<String> entityTypes;

      if (entityTypesValue instanceof List) {
        entityTypes = (List<String>) entityTypesValue;
      } else if (entityTypesValue instanceof String) {
        // Try to parse as JSON array, fallback to single string
        String strValue = (String) entityTypesValue;
        if (strValue.trim().startsWith("[") && strValue.trim().endsWith("]")) {
          entityTypes = JsonUtils.readOrConvertValue(strValue, List.class);
        } else {
          // Legacy single entityType
          entityTypes = new ArrayList<>();
          entityTypes.add(strValue);
        }
      } else {
        // Fallback: try to convert to List
        entityTypes = JsonUtils.readOrConvertValue(entityTypesValue, List.class);
      }

      // For non-batch triggers, we might need to process all types
      // But this is likely an error - log a warning
      if (entityTypes != null && entityTypes.size() > 1) {
        LOG.warn(
            "Multiple entity types configured for a single process instance: {}. This may cause performance issues.",
            entityTypes);
        // For safety, only process the first one to avoid performance degradation
        entityTypeToFetch = entityTypes.getFirst();
      } else {
        assert entityTypes != null;
        if (!entityTypes.isEmpty()) {
          entityTypeToFetch = entityTypes.getFirst();
        }
      }
    }

    String searchFilter =
        Optional.ofNullable(searchFilterExpr)
            .map(expr -> (String) expr.getValue(execution))
            .orElse(null);

    // Log the filter being used for this entity type
    if (searchFilter != null && entityTypeToFetch != null) {
      LOG.debug("Using filter for entity type '{}': {}", entityTypeToFetch, searchFilter);
    }

    int batchSize = Integer.parseInt((String) batchSizeExpr.getValue(execution));

    List<String> entityList = new ArrayList<>();

    // Process only the single entity type for this process instance
    if (entityTypeToFetch != null) {
      List<Object> searchAfter =
          JsonUtils.readOrConvertValues(execution.getVariable("searchAfter"), Object.class);

      SearchResultListMapper response =
          fetchEntities(searchAfter, entityTypeToFetch, searchFilter, batchSize);

      String finalEntityTypeToFetch = entityTypeToFetch;
      entityList.addAll(
          response.getResults().stream()
              .map(
                  result ->
                      new MessageParser.EntityLink(
                              finalEntityTypeToFetch, (String) result.get("fullyQualifiedName"))
                          .getLinkString())
              .toList());
      execution.setVariable("searchAfter", JsonUtils.pojoToJson(response.getLastHitSortValues()));
    }

    int cardinality = entityList.size();
    boolean hasFinished = entityList.isEmpty();

    execution.setVariable(CARDINALITY_VARIABLE, cardinality);
    execution.setVariable(HAS_FINISHED_VARIABLE, hasFinished);
    execution.setVariable(COLLECTION_VARIABLE, entityList);
  }

  private SearchResultListMapper fetchEntities(
      List<Object> searchAfterList, String entityType, String searchFilter, int batchSize) {
    SearchRepository searchRepository = Entity.getSearchRepository();
    SearchSortFilter searchSortFilter =
        new SearchSortFilter("fullyQualifiedName", null, null, null);
    Object[] searchAfter = searchAfterList.isEmpty() ? null : searchAfterList.toArray();

    try {
      return searchRepository.listWithDeepPagination(
          entityType,
          null,
          searchFilter,
          new String[] {"fullyQualifiedName"},
          searchSortFilter,
          batchSize,
          searchAfter);
    } catch (IOException e) {
      LOG.error(
          "Failed to fetch entities of type '{}' with filter: {}", entityType, searchFilter, e);
      throw new RuntimeException(
          String.format("Failed to fetch %s entities: %s", entityType, e.getMessage()), e);
    } catch (Exception e) {
      LOG.error(
          "Unexpected error fetching entities of type '{}' with filter: {}",
          entityType,
          searchFilter,
          e);
      throw new RuntimeException(
          String.format("Unexpected error fetching %s entities: %s", entityType, e.getMessage()),
          e);
    }
  }
}
