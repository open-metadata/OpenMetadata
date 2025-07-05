package org.openmetadata.service.search;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;

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
          Entity.API_ENDPOINT,
          "directory_search_index",
          Entity.DIRECTORY,
          "worksheet_search_index",
          Entity.WORKSHEET,
          "spreadsheet_search_index",
          Entity.SPREADSHEET,
          "file_search_index",
          Entity.FILE -> true;
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
          "metadata_service_index",
          "drive_service_index" -> true;
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
      case "glossary_search_index", Entity.GLOSSARY -> Entity.GLOSSARY;
      case "domain_search_index", Entity.DOMAIN -> Entity.DOMAIN;
      case "data_product_search_index", Entity.DATA_PRODUCT -> Entity.DATA_PRODUCT;
      case "team_search_index", Entity.TEAM -> Entity.TEAM;
      case "user_search_index", Entity.USER -> Entity.USER;
      case "directory_search_index", Entity.DIRECTORY -> Entity.DIRECTORY;
      case "file_search_index", Entity.FILE -> Entity.FILE;
      case "worksheet_search_index", Entity.WORKSHEET -> Entity.WORKSHEET;
      case "spreadsheet_search_index", Entity.SPREADSHEET -> Entity.SPREADSHEET;
      case "dataAsset" -> "dataAsset";
      default -> "dataAsset";
    };
  }
}
