package org.openmetadata.service.search;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;

@Slf4j
public class SearchUtil {
  /**
   * Check if the index is a data asset index
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
          Entity.API_COLLECTION,
          "api_endpoint_search_index",
          Entity.API_ENDPOINT,
          "directory_search_index",
          Entity.DIRECTORY,
          "worksheet_search_index",
          Entity.WORKSHEET,
          "spreadsheet_search_index",
          Entity.SPREADSHEET,
          "file_search_index",
          Entity.FILE,
          "metric_search_index",
          Entity.METRIC -> true;
      default -> false;
    };
  }

  public static boolean isTimeSeriesIndex(String indexName) {
    return switch (indexName) {
      case "test_case_result_search_index",
          "testCaseResult",
          "test_case_resolution_status_search_index",
          "testCaseResolutionStatus",
          "raw_cost_analysis_report_data_index",
          "rawCostAnalysisReportData",
          "aggregated_cost_analysis_report_data_index",
          "aggregatedCostAnalysisReportData" -> true;
      default -> false;
    };
  }

  public static boolean isDataQualityIndex(String indexName) {
    return switch (indexName) {
      case "test_case_search_index", "testCase", "test_suite_search_index", "testSuite" -> true;
      default -> false;
    };
  }

  public static boolean isColumnIndex(String indexName) {
    return switch (indexName) {
      case "column_search_index", Entity.TABLE_COLUMN -> true;
      default -> false;
    };
  }

  public static boolean isServiceIndex(String indexName) {
    return switch (indexName) {
      case "api_service_search_index",
          "apiService",
          "mlmodel_service_search_index",
          "mlModelService",
          "database_service_search_index",
          "databaseService",
          "messaging_service_index",
          "messagingService",
          "dashboard_service_index",
          "dashboardService",
          "pipeline_service_index",
          "pipelineService",
          "storage_service_index",
          "storageService",
          "search_service_index",
          "searchService",
          "security_service_index",
          "securityService",
          "metadata_service_index",
          "metadataService",
          "drive_service_index",
          "driveService" -> true;
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
      case "api_collection_search_index", Entity.API_COLLECTION -> Entity.API_COLLECTION;
      case "metric_search_index", Entity.METRIC -> Entity.METRIC;
      case "search_entity_search_index", Entity.SEARCH_INDEX -> Entity.SEARCH_INDEX;
      case "tag_search_index", Entity.TAG -> Entity.TAG;
      case "glossary_term_search_index", Entity.GLOSSARY_TERM -> Entity.GLOSSARY_TERM;
      case "glossary_search_index", Entity.GLOSSARY -> Entity.GLOSSARY;
      case "domain_search_index", Entity.DOMAIN -> Entity.DOMAIN;
      case "data_product_search_index", Entity.DATA_PRODUCT -> Entity.DATA_PRODUCT;
      case "team_search_index", Entity.TEAM -> Entity.TEAM;
      case "user_search_index", Entity.USER -> Entity.USER;
      case "directory_search_index", Entity.DIRECTORY -> Entity.DIRECTORY;
      case "file_search_index", Entity.FILE -> Entity.FILE;
      case "worksheet_search_index", Entity.WORKSHEET -> Entity.WORKSHEET;
      case "spreadsheet_search_index", Entity.SPREADSHEET -> Entity.SPREADSHEET;
      case "column_search_index", Entity.TABLE_COLUMN -> Entity.TABLE_COLUMN;
      case "dataAsset" -> "dataAsset";
      default -> "dataAsset";
    };
  }

  /**
   * Get fuzziness value based on query term count.
   * For queries with more than 2 words, disable fuzziness to prevent clause explosion.
   */
  public static String getFuzziness(String query) {
    if (query == null || query.isBlank()) {
      return "1";
    }
    int termCount = query.trim().split("\\s+").length;
    return termCount > 2 ? "0" : "1";
  }

  /**
   * Get max expansions value based on query term count.
   * For queries with more than 2 words, reduce expansions to prevent clause explosion.
   */
  public static int getMaxExpansions(String query) {
    if (query == null || query.isBlank()) {
      return 10;
    }
    int termCount = query.trim().split("\\s+").length;
    return termCount > 2 ? 2 : 10;
  }
}
