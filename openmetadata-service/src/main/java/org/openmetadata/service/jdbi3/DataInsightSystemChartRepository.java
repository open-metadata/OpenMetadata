package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.DATA_INSIGHT_CUSTOM_CHART;

import java.io.IOException;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.util.EntityUtil;

public class DataInsightSystemChartRepository extends EntityRepository<DataInsightCustomChart> {
  public static final String COLLECTION_PATH = "/v1/analytics/dataInsights/system/charts";
  private static final SearchClient searchClient = Entity.getSearchRepository().getSearchClient();
  public static final String TIMESTAMP_FIELD = "@timestamp";

  public static final Set<String> dataAssetTypes =
      Set.of(
          "table",
          "storedProcedure",
          "databaseSchema",
          "database",
          "chart",
          "dashboard",
          "dashboardDataModel",
          "pipeline",
          "topic",
          "container",
          "searchIndex",
          "mlmodel",
          "dataProduct",
          "glossaryTerm",
          "tag",
          "testCaseResult",
          "testCaseResolutionStatus");

  public static final String DI_SEARCH_INDEX_PREFIX = "di-data-assets";

  public static final String DI_SEARCH_INDEX = "di-data-assets-*";

  public static final String FORMULA_FUNC_REGEX =
      "\\b(count|sum|min|max|avg|unique)+\\((k='([^']*)')?,?\\s*(q='([^']*)')?\\)?";

  public static final String NUMERIC_VALIDATION_REGEX = "[\\d\\.+-\\/\\*\\(\\)\s]+";

  public DataInsightSystemChartRepository() {
    super(
        COLLECTION_PATH,
        DATA_INSIGHT_CUSTOM_CHART,
        DataInsightCustomChart.class,
        Entity.getCollectionDAO().dataInsightCustomChartDAO(),
        "",
        "");
  }

  public static String getDataInsightsIndexPrefix() {
    String clusterAlias = Entity.getSearchRepository().getClusterAlias();
    if (!(clusterAlias == null || clusterAlias.isEmpty())) {
      return String.format("%s-%s", clusterAlias, DI_SEARCH_INDEX_PREFIX);
    }
    return DI_SEARCH_INDEX_PREFIX;
  }

  public static String getDataInsightsSearchIndex() {
    String clusterAlias = Entity.getSearchRepository().getClusterAlias();
    if (!(clusterAlias == null || clusterAlias.isEmpty())) {
      return String.format("%s-%s", clusterAlias, DI_SEARCH_INDEX);
    }
    return DI_SEARCH_INDEX;
  }

  @Override
  public void setFields(DataInsightCustomChart entity, EntityUtil.Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void clearFields(DataInsightCustomChart entity, EntityUtil.Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void prepare(DataInsightCustomChart entity, boolean update) {
    /* Nothing to do */
  }

  @Override
  public void storeEntity(DataInsightCustomChart entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeRelationships(DataInsightCustomChart entity) {
    // No relationships to store beyond what is stored in the super class
  }

  public DataInsightCustomChartResultList getPreviewData(
      DataInsightCustomChart chart, long startTimestamp, long endTimestamp, String filter)
      throws IOException {
    if (chart.getChartDetails() != null && filter != null) {
      HashMap chartDetails = (LinkedHashMap<String, Object>) chart.getChartDetails();
      if (chartDetails.get("metrics") != null) {
        for (LinkedHashMap<String, Object> metrics :
            (List<LinkedHashMap<String, Object>>) chartDetails.get("metrics")) {
          metrics.put("filter", filter);
        }
      }
    }
    return getPreviewData(chart, startTimestamp, endTimestamp);
  }

  public DataInsightCustomChartResultList getPreviewData(
      DataInsightCustomChart chart, long startTimestamp, long endTimestamp) throws IOException {
    return searchClient.buildDIChart(chart, startTimestamp, endTimestamp);
  }

  public Map<String, DataInsightCustomChartResultList> listChartData(
      String chartNames, long startTimestamp, long endTimestamp, String filter) throws IOException {
    HashMap<String, DataInsightCustomChartResultList> result = new HashMap<>();
    if (chartNames == null) {
      return result;
    }

    for (String chartName : chartNames.split(",")) {
      DataInsightCustomChart chart =
          Entity.getEntityByName(DATA_INSIGHT_CUSTOM_CHART, chartName, "", Include.NON_DELETED);

      if (chart != null) {
        if (chart.getChartDetails() != null && filter != null) {
          HashMap chartDetails = (LinkedHashMap<String, Object>) chart.getChartDetails();
          if (chartDetails.get("metrics") != null) {
            for (LinkedHashMap<String, Object> metrics :
                (List<LinkedHashMap<String, Object>>) chartDetails.get("metrics")) {
              metrics.put("filter", filter);
            }
          }
        }
        DataInsightCustomChartResultList data =
            searchClient.buildDIChart(chart, startTimestamp, endTimestamp);
        result.put(chartName, data);
      }
    }
    return result;
  }

  public String generateAPIRequest(String prompt) {
    try {
      // Define the API endpoint URL
      URL url = new URL("http://10.71.6.85:5003/generate");
      
      // Open a connection to the URL
      HttpURLConnection connection = (HttpURLConnection) url.openConnection();
      
      // Set up the HTTP request
      connection.setRequestMethod("POST");
      
      // Set request headers based on example request
      connection.setRequestProperty("Content-Type", "application/json");
      connection.setRequestProperty("Accept", "*/*");
      connection.setRequestProperty("Connection", "keep-alive");
      
      // Remove the authorization header as it's not needed
      // connection.setRequestProperty("Authorization", "Bearer YOUR_API_KEY_HERE");
      
      connection.setDoOutput(true);
      
      // Create the request body
      JSONObject requestBody = new JSONObject();
      requestBody.put("use_case", prompt);
      
      // Convert body to bytes
      byte[] input = requestBody.toString().getBytes(StandardCharsets.UTF_8);
      
      // Set content length
      connection.setRequestProperty("Content-Length", String.valueOf(input.length));
      
      // Send the request
      try (OutputStream os = connection.getOutputStream()) {
          os.write(input, 0, input.length);
      }
      
      // Check the response code first
      int responseCode = connection.getResponseCode();
      if (responseCode == 200) {
        // Get the response for successful requests
        StringBuilder response = new StringBuilder();
        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
            String responseLine;
            while ((responseLine = br.readLine()) != null) {
                response.append(responseLine.trim());
            }
        }
        return response.toString();
      } else {
        // Handle error responses
        StringBuilder errorResponse = new StringBuilder();
        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(connection.getErrorStream() != null ? 
                        connection.getErrorStream() : new java.io.ByteArrayInputStream(new byte[0]), 
                        StandardCharsets.UTF_8))) {
            String responseLine;
            while ((responseLine = br.readLine()) != null) {
                errorResponse.append(responseLine.trim());
            }
        } catch (Exception e) {
            // Error stream might be null
            errorResponse.append("No detailed error information available");
        }
        
        return "Error: HTTP " + responseCode + " - " + errorResponse.toString();
      }
    } catch (Exception e) {
      // Handle any exceptions
      return "Error calling API: " + e.getMessage();
    }
  }

}
