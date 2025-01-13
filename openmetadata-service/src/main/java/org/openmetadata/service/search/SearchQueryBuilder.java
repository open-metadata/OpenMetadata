package org.openmetadata.service.search;

import es.org.elasticsearch.search.builder.SearchSourceBuilder;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.settings.SettingsCache;

import java.io.IOException;

public interface SearchQueryBuilder {
  SearchSourceBuilder getSearchSourceBuilder(String index, String q, int from, int size) throws IOException;
  void applyDeletedLogic(SearchRequest request, SearchSourceBuilder searchSourceBuilder);
  void applyGlossaryHierarchyLogic(SearchRequest request, SearchSourceBuilder searchSourceBuilder);
  default String getAssetTypeFromIndex(String index) {
    return switch (index) {
      case "topic_search_index", "topic" -> "topic";
      case "dashboard_search_index", "dashboard" -> "dashboard";
      case "pipeline_search_index", "pipeline" -> "pipeline";
      case "mlmodel_search_index", "mlmodel" -> "mlmodel";
      case "table_search_index", "table" -> "table";
      case "database_schema_search_index",
           "databaseSchema",
           "database_search_index",
           "database" -> "dataAsset";
      case "user_search_index", "user", "team_search_index", "team" -> "user";
      case "glossary_term_search_index", "glossaryTerm" -> "glossaryTerm";
      case "tag_search_index", "tag" -> "tag";
      case "container_search_index", "container" -> "container";
      case "query_search_index", "query" -> "query";
      case "test_case_search_index",
           "testCase",
           "test_suite_search_index",
           "testSuite" -> "testCase";
      case "stored_procedure_search_index", "storedProcedure" -> "storedProcedure";
      case "dashboard_data_model_search_index",
           "dashboardDataModel" -> "dashboardDataModel";
      case "search_entity_search_index", "searchIndex" -> "searchIndex";
      case "domain_search_index", "domain" -> "domain";
      case "raw_cost_analysis_report_data_index" -> "rawCostAnalysisReportData";
      case "aggregated_cost_analysis_report_data_index" -> "aggregatedCostAnalysisReportData";
      case "data_product_search_index" -> "dataProduct";
      case "test_case_resolution_status_search_index" -> "test_case_resolution_status_search_index";
      case "test_case_result_search_index" -> "testCase";
      case "api_endpoint_search_index", "apiEndpoint" -> "apiEndpoint";
      case "api_service_search_index",
           "mlmodel_service_search_index",
           "database_service_search_index",
           "messaging_service_index",
           "dashboard_service_index",
           "pipeline_service_index",
           "storage_service_index",
           "search_service_index",
           "metadata_service_index" -> "default";
      case "dataAsset" -> "dataAsset";
      case "all" -> "all";
      default -> "dataAsset";
    };
  }

  default SearchSettings getSearchSettings() {
    return SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class);
  }
}
