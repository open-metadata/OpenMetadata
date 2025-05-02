package org.openmetadata.service.search;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class SearchUtil {

  /**
   * Check if the index is a data asset index
   * @param indexName name of the index to check
   * @return true if index is a data asset, false otherwise
   */
  public static boolean isDataAssetIndex(String indexName) {
    return switch (indexName) {
      case "topic_search_index",
          Entity.TOPIC,
          "dashboard_search_index",
          Entity.DASHBOARD,
          "pipeline_search_index",
          Entity.PIPELINE,
          "mlmodel_search_index",
          Entity.MLMODEL,
          "table_search_index",
          Entity.TABLE,
          "database_schema_search_index",
          Entity.DATABASE_SCHEMA,
          "database_search_index",
          Entity.DATABASE,
          "container_search_index",
          Entity.CONTAINER,
          "query_search_index",
          Entity.QUERY,
          "stored_procedure_search_index",
          Entity.STORED_PROCEDURE,
          "dashboard_data_model_search_index",
          Entity.DASHBOARD_DATA_MODEL,
          "data_product_search_index",
          Entity.DATA_PRODUCT,
          "domain_search_index",
          Entity.DOMAIN,
          "glossary_term_search_index",
          Entity.GLOSSARY_TERM,
          "glossary_search_index",
          Entity.GLOSSARY,
          "tag_search_index",
          Entity.TAG,
          "search_entity_search_index",
          Entity.SEARCH_INDEX,
          "api_collection_search_index",
          Entity.API_COLLCECTION,
          "api_endpoint_search_index",
          Entity.API_ENDPOINT -> true;
      default -> false;
    };
  }

  public static boolean isTimeSeriesIndex(String indexName) {
    return switch (indexName) {
      case "test_case_result_search_index",
          "test_case_resolution_status_search_index",
          "raw_cost_analysis_report_data_index",
          "aggregated_cost_analysis_report_data_index" -> true;
      default -> false;
    };
  }

  public static boolean isDataQualityIndex(String indexName) {
    return switch (indexName) {
      case "test_case_search_index", "testCase", "test_suite_search_index", "testSuite" -> true;
      default -> false;
    };
  }

  public static boolean isServiceIndex(String indexName) {
    return switch (indexName) {
      case "api_service_search_index",
          "mlmodel_service_search_index",
          "database_service_search_index",
          "messaging_service_index",
          "dashboard_service_index",
          "pipeline_service_index",
          "storage_service_index",
          "search_service_index",
          "metadata_service_index" -> true;
      default -> false;
    };
  }

  public static String mapEntityTypesToIndexNames(String indexName) {
    return switch (indexName) {
      case "topic_search_index", Entity.TOPIC -> Entity.TOPIC;
      case "dashboard_search_index", Entity.DASHBOARD -> Entity.DASHBOARD;
      case "pipeline_search_index", Entity.PIPELINE -> Entity.PIPELINE;
      case "mlmodel_search_index", Entity.MLMODEL -> Entity.MLMODEL;
      case "table_search_index", Entity.TABLE -> Entity.TABLE;
      case "database_search_index", Entity.DATABASE -> Entity.DATABASE;
      case "database_schema_search_index", Entity.DATABASE_SCHEMA -> Entity.DATABASE_SCHEMA;
      case "container_search_index", Entity.CONTAINER -> Entity.CONTAINER;
      case "query_search_index", Entity.QUERY -> Entity.QUERY;
      case "stored_procedure_search_index", Entity.STORED_PROCEDURE -> Entity.STORED_PROCEDURE;
      case "dashboard_data_model_search_index", Entity.DASHBOARD_DATA_MODEL -> Entity
          .DASHBOARD_DATA_MODEL;
      case "api_endpoint_search_index", Entity.API_ENDPOINT -> Entity.API_ENDPOINT;
      case "search_entity_search_index", Entity.SEARCH_INDEX -> Entity.SEARCH_INDEX;
      case "tag_search_index", Entity.TAG -> Entity.TAG;
      case "glossary_term_search_index", Entity.GLOSSARY_TERM -> Entity.GLOSSARY_TERM;
      case "domain_search_index", Entity.DOMAIN -> Entity.DOMAIN;
      case "data_product_search_index", Entity.DATA_PRODUCT -> Entity.DATA_PRODUCT;
      default -> "default";
    };
  }

  public static Map<String, Object> searchMetadata(Map<String, Object> params) {
    try {
      LOG.info("Executing searchMetadata with params: {}", params);
      String query = params.containsKey("query") ? (String) params.get("query") : "*";
      int limit = 10;
      if (params.containsKey("limit")) {
        Object limitObj = params.get("limit");
        if (limitObj instanceof Number) {
          limit = ((Number) limitObj).intValue();
        } else if (limitObj instanceof String) {
          limit = Integer.parseInt((String) limitObj);
        }
      }

      boolean includeDeleted = false;
      if (params.containsKey("include_deleted")) {
        Object deletedObj = params.get("include_deleted");
        if (deletedObj instanceof Boolean) {
          includeDeleted = (Boolean) deletedObj;
        } else if (deletedObj instanceof String) {
          includeDeleted = "true".equals(deletedObj);
        }
      }

      String entityType =
          params.containsKey("entity_type") ? (String) params.get("entity_type") : null;
      String index =
          (entityType != null && !entityType.isEmpty())
              ? mapEntityTypesToIndexNames(entityType)
              : Entity.TABLE;

      LOG.info(
          "Search query: {}, index: {}, limit: {}, includeDeleted: {}",
          query,
          index,
          limit,
          includeDeleted);

      SearchRequest searchRequest =
          new SearchRequest()
              .withQuery(query)
              .withIndex(index)
              .withSize(limit)
              .withFrom(0)
              .withFetchSource(true)
              .withDeleted(includeDeleted);

      javax.ws.rs.core.Response response = Entity.getSearchRepository().search(searchRequest, null);

      if (response.getEntity() instanceof String responseStr) {
        LOG.info("Search returned string response");
        JsonNode jsonNode = JsonUtils.readTree(responseStr);
        return JsonUtils.convertValue(jsonNode, Map.class);
      } else {
        LOG.info("Search returned object response: {}", response.getEntity().getClass().getName());
        return JsonUtils.convertValue(response.getEntity(), Map.class);
      }
    } catch (Exception e) {
      LOG.error("Error in searchMetadata", e);
      Map<String, Object> error = new HashMap<>();
      error.put("error", e.getMessage());
      return error;
    }
  }
}
