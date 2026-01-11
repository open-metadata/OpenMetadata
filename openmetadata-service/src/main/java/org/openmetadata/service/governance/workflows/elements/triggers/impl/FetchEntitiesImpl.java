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
    // For PeriodicBatchEntityTrigger: extract entity type from process definition key
    // Format: triggerWorkflowId-EntityType (e.g., "workflowTrigger-Table")
    String processDefinitionKey = execution.getProcessDefinitionId().split(":")[0];
    String entityTypeToFetch = extractEntityTypeFromProcessKey(processDefinitionKey);

    // If not a batch trigger process, use the configured entity types
    if (entityTypeToFetch == null) {
      List<String> entityTypes = new ArrayList<>();
      try {
        entityTypes = JsonUtils.readOrConvertValue(entityTypesExpr.getValue(execution), List.class);
      } catch (Exception exception) {
        // If there is an exception, then the entityTypes expression is a string
        entityTypeToFetch =
            JsonUtils.readOrConvertValue(entityTypesExpr.getValue(execution), String.class);
      }
      if (entityTypes != null && !entityTypes.isEmpty()) {
        // For non-batch triggers, only process the first entity type to avoid performance issues
        entityTypeToFetch = entityTypes.getFirst();
        if (entityTypes.size() > 1) {
          LOG.warn(
              "Multiple entity types {} configured for non-batch process. Only processing: {}",
              entityTypes,
              entityTypeToFetch);
        }
      }
    }

    if (entityTypeToFetch == null) {
      LOG.error("No entity type found for process {}", processDefinitionKey);
      throw new IllegalStateException("Entity type is required but not found");
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
      execution.setVariable("searchAfter", response.getLastDocumentsInBatch());
    }

    int cardinality = entityList.size();
    boolean hasFinished = entityList.isEmpty();

    execution.setVariable(CARDINALITY_VARIABLE, cardinality);
    execution.setVariable(HAS_FINISHED_VARIABLE, hasFinished);
    execution.setVariable(COLLECTION_VARIABLE, entityList);
  }

  private String extractEntityTypeFromProcessKey(String processKey) {
    // PeriodicBatchEntityTrigger format: triggerWorkflowId-EntityType
    if (processKey.contains("-")) {
      String[] parts = processKey.split("-");
      if (parts.length >= 2) {
        return parts[parts.length - 1]; // Return the entity type suffix
      }
    }
    return null;
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
