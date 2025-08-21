package org.openmetadata.service.governance.workflows.elements.triggers.impl;

import static org.openmetadata.service.governance.workflows.elements.triggers.PeriodicBatchEntityTrigger.CARDINALITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.elements.triggers.PeriodicBatchEntityTrigger.COLLECTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.elements.triggers.PeriodicBatchEntityTrigger.HAS_FINISHED_VARIABLE;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchResultListMapper;
import org.openmetadata.service.search.SearchSortFilter;

public class FetchEntitiesImpl implements JavaDelegate {
  private Expression entityTypesExpr;
  private Expression searchFilterExpr;
  private Expression batchSizeExpr;

  @Override
  public void execute(DelegateExecution execution) {
    // Handle both legacy entityType (string) and new entityTypes (array) for backward compatibility
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
    String searchFilter =
        Optional.ofNullable(searchFilterExpr)
            .map(expr -> (String) expr.getValue(execution))
            .orElse(null);
    int batchSize = Integer.parseInt((String) batchSizeExpr.getValue(execution));

    List<String> entityList = new ArrayList<>();
    for (String entityType : entityTypes) {
      List<Object> searchAfter =
          JsonUtils.readOrConvertValues(execution.getVariable("searchAfter"), Object.class);

      SearchResultListMapper response =
          fetchEntities(searchAfter, entityType, searchFilter, batchSize);

      entityList.addAll(
          response.getResults().stream()
              .map(
                  result ->
                      new MessageParser.EntityLink(
                              entityType, (String) result.get("fullyQualifiedName"))
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
      throw new RuntimeException(e);
    }
  }
}
