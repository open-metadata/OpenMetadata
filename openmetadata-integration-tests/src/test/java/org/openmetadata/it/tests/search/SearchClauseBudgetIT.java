package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.TreeSet;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.it.search.SearchClusterResetExtension;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.search.IndexMappingLoader;

/**
 * The clause cost of every search path stays within the engine's default max_clause_count (1024
 * on OpenSearch) for worst-case input. A query that exceeds it fails with too_many_nested_clauses:
 * an error on a single index, and silently dropped shards on an alias. A new field, analyzer or
 * query path that breaks the budget fails here, in the change that introduces it (#34380).
 */
@ExtendWith({TestNamespaceExtension.class, SearchClusterResetExtension.class})
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class SearchClauseBudgetIT {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private static final List<String> REPRESENTATIVE_TARGETS =
      List.of(
          "table_search_index",
          "dataAsset",
          "all",
          "glossary_term_search_index",
          "column_search_index",
          "dashboard_search_index",
          "test_case_result_search_index");

  @Test
  void everyEndpointStaysWithinTheClauseBudget() throws Exception {
    List<String> failures = new ArrayList<>();
    for (String target : REPRESENTATIVE_TARGETS) {
      for (Map.Entry<String, String> input : inputs().entrySet()) {
        for (String path : endpoints(target, input.getValue())) {
          check(path, input.getKey(), failures);
        }
      }
    }
    assertThat(failures)
        .as("requests over the clause budget:%n%s", String.join("\n", failures))
        .isEmpty();
  }

  @Test
  void everyIndexStaysWithinTheClauseBudgetOnSearch() throws Exception {
    Map<String, String> heaviest = new LinkedHashMap<>();
    heaviest.put("128-char run", randomRun(128));
    heaviest.put("300-char run", randomRun(300));
    heaviest.put("4000-char run", randomRun(4000));
    heaviest.put("60-word sentence", sentence(60));
    heaviest.put("60 two-part words", twoPartWords(60));
    List<String> indexes = existingIndexes();
    assertThat(indexes).as("indexes found on the cluster").hasSizeGreaterThan(20);
    List<String> failures = new ArrayList<>();
    for (String index : indexes) {
      for (Map.Entry<String, String> input : heaviest.entrySet()) {
        check(searchPath(index, input.getValue()), input.getKey(), failures);
      }
    }
    assertThat(failures)
        .as("requests over the clause budget:%n%s", String.join("\n", failures))
        .isEmpty();
  }

  private static Map<String, String> inputs() {
    Map<String, String> inputs = new LinkedHashMap<>();
    for (int length : List.of(21, 40, 100, 128, 300, 4000)) {
      inputs.put(length + "-char run", randomRun(length));
    }
    inputs.put("60-word sentence", sentence(60));
    inputs.put("60 two-part words", twoPartWords(60));
    inputs.put(
        "long CamelCase",
        "LhrIncomingFlightsArrivalsScheduleV1OrdersByRegionAndMonthForTheSalesWarehouseTeam");
    inputs.put("field syntax", "columnNames:address AND orders");
    inputs.put("wildcard", "*cust*");
    inputs.put("quoted phrase", "\"monthly revenue by region\"");
    inputs.put("accents", "données_clients_été_2024_archivées");
    inputs.put("cjk", "顧客注文履歴テーブル");
    inputs.put("200 cjk characters", "顧客注文履歴テーブル売上地域".repeat(15));
    return inputs;
  }

  private static List<String> endpoints(String index, String text) {
    String i = encode(index);
    String q = encode(text);
    return List.of(
        searchPath(index, text),
        "/v1/search/nlq/query?index=" + i + "&size=10&q=" + q,
        "/v1/search/aggregate?index=" + i + "&field=entityType&size=10&q=" + q,
        "/v1/search/aggregate?index=" + i + "&field=entityType&size=10&q=&queryText=" + q);
  }

  private static String searchPath(String index, String text) {
    return "/v1/search/query?index=" + encode(index) + "&size=10&q=" + encode(text);
  }

  private static void check(String path, String inputName, List<String> failures) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + path))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Accept", "application/json")
            .timeout(Duration.ofSeconds(60))
            .GET()
            .build();
    HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
    String where = inputName + " -> " + path.substring(0, path.indexOf('?')) + " " + indexOf(path);
    if (response.statusCode() != 200) {
      failures.add(where + ": HTTP " + response.statusCode() + " " + abbreviate(response.body()));
      return;
    }
    JsonNode shards = MAPPER.readTree(response.body()).path("_shards");
    if (shards.path("failed").asInt(0) > 0) {
      failures.add(where + ": " + shards.path("failed").asInt() + " shards failed");
    }
  }

  /** Indexes declared in indexMapping.json that exist on this cluster. */
  private static List<String> existingIndexes() {
    ServerHandle server = OssTestServer.defaultHandle();
    IndexAliasInspector inspector = new IndexAliasInspector(server);
    SearchClient cluster = new SearchClient(server);
    TreeSet<String> names = new TreeSet<>();
    for (String entityType : inspector.declaredEntityTypes()) {
      if (cluster.indexExists(inspector.indexNameFor(entityType))) {
        names.add(
            IndexMappingLoader.getInstance().getIndexMapping().get(entityType).getIndexName());
      }
    }
    names.removeAll(REPRESENTATIVE_TARGETS);
    return new ArrayList<>(names);
  }

  /** Letters and digits, seeded by length so a failure reproduces with the same input. */
  private static String randomRun(int length) {
    String alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    Random random = new Random(length);
    StringBuilder run = new StringBuilder(length);
    for (int i = 0; i < length; i++) {
      run.append(alphabet.charAt(random.nextInt(alphabet.length())));
    }
    return run.toString();
  }

  /** Distinct words: repeated ones collapse into one clause per field and cost nothing extra. */
  private static String sentence(int words) {
    Random random = new Random(words);
    List<String> picked = new ArrayList<>();
    for (int i = 0; i < words; i++) {
      StringBuilder word = new StringBuilder();
      for (int j = 0; j < 4 + random.nextInt(5); j++) {
        word.append((char) ('a' + random.nextInt(26)));
      }
      picked.add(word.toString());
    }
    return String.join(" ", picked);
  }

  /** Words like "a1" that the analyzer splits in two and also keeps whole: the most terms per word. */
  private static String twoPartWords(int words) {
    List<String> picked = new ArrayList<>();
    for (int i = 0; i < words; i++) {
      picked.add((char) ('a' + i % 26) + String.valueOf(i % 10));
    }
    return String.join(" ", picked);
  }

  private static String indexOf(String path) {
    int start = path.indexOf("index=") + "index=".length();
    int end = path.indexOf('&', start);
    return path.substring(start, end < 0 ? path.length() : end);
  }

  private static String abbreviate(String body) {
    return body.length() > 300 ? body.substring(0, 300) + "..." : body;
  }

  private static String encode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }
}
