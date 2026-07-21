package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespaceExtension;

/**
 * Integration tests for the RDF SQL resource ({@code POST /v1/rdf/sql/query} and {@code POST
 * /v1/rdf/sql/translate}).
 *
 * <p>These endpoints translate whole-graph SQL into SPARQL and (for {@code /query}) execute it
 * against the RDF store. The resource is a raw string-body endpoint, so tests drive it via {@link
 * HttpClient} rather than the fluent SDK.
 *
 * <p>Security note: {@link org.openmetadata.service.resources.rdf.RdfSqlResource} injects an {@code
 * Authorizer} but never calls {@code authorize(...)} on either method, so any authenticated
 * principal can run arbitrary whole-graph SQL. {@link #testNonAdminIsDeniedSqlQuery} and {@link
 * #testNonAdminIsDeniedSqlTranslate} encode the DESIRED behavior (non-privileged users are denied);
 * they will fail until an {@code authorizeAdmin(...)} / {@code authorize(...)} call is added to the
 * resource, at which point the security hole is closed.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class RdfSqlResourceIT {

  private static final String SQL_QUERY_PATH = "/v1/rdf/sql/query";
  private static final String SQL_TRANSLATE_PATH = "/v1/rdf/sql/translate";
  private static final String VALID_SQL = "SELECT name, description FROM tables";
  private static final String INVALID_SQL = "INVALID SQL QUERY";
  private static final String SPARQL_JSON = "application/sparql-results+json";
  private static final String APPLICATION_JSON = "application/json";
  private static final String CSV = "text/csv";
  private static final long TOKEN_TTL_SECONDS = 86400;

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();

  @BeforeAll
  static void requireRdfEnabled() {
    assumeTrue(
        RdfTestUtils.isRdfEnabled(),
        "RDF is disabled for this test run. Use the RDF test profile to execute RdfSqlResourceIT.");
  }

  @Test
  void testNonAdminIsDeniedSqlQuery() throws Exception {
    HttpResponse<String> response = postSql(SQL_QUERY_PATH, nonAdminToken(), VALID_SQL);
    assertEquals(
        403,
        response.statusCode(),
        "Non-privileged user must be denied whole-graph SQL execution; got: " + response.body());
  }

  @Test
  void testNonAdminIsDeniedSqlTranslate() throws Exception {
    HttpResponse<String> response = postSql(SQL_TRANSLATE_PATH, nonAdminToken(), VALID_SQL);
    assertEquals(
        403,
        response.statusCode(),
        "Non-privileged user must be denied SQL-to-SPARQL translation; got: " + response.body());
  }

  @Test
  void testQueryHappyPathReturnsSparqlResultsJson() throws Exception {
    HttpResponse<String> response = postSql(SQL_QUERY_PATH, adminToken(), VALID_SQL);

    assertEquals(200, response.statusCode(), "Valid SQL should execute; got: " + response.body());
    assertContentType(response, SPARQL_JSON);
    assertTrue(
        response.body().contains("\"head\""),
        "SPARQL results JSON should contain a head section: " + response.body());
  }

  @Test
  void testTranslateHappyPathReturnsTranslationResponseWithoutExecuting() throws Exception {
    HttpResponse<String> response = postSql(SQL_TRANSLATE_PATH, adminToken(), VALID_SQL);

    assertEquals(200, response.statusCode(), "Valid SQL should translate; got: " + response.body());
    assertContentType(response, APPLICATION_JSON);

    JsonNode body = MAPPER.readTree(response.body());
    assertEquals(
        VALID_SQL,
        body.path("sqlQuery").asText(),
        "TranslationResponse should echo the original SQL query");

    String sparql = body.path("sparqlQuery").asText();
    assertFalse(sparql.isBlank(), "TranslationResponse should carry a non-empty SPARQL query");
    assertTrue(
        sparql.toUpperCase(Locale.ROOT).contains("SELECT"),
        "Translated query should be SPARQL SELECT text: " + sparql);
    assertFalse(
        body.has("head") || body.has("results"),
        "translate endpoint must NOT execute the query (no sparql-results payload): "
            + response.body());
  }

  @Test
  void testQueryInvalidSqlReturnsBadRequest() throws Exception {
    HttpResponse<String> response = postSql(SQL_QUERY_PATH, adminToken(), INVALID_SQL);
    assertEquals(
        400,
        response.statusCode(),
        "Unparseable SQL should yield 400 from /query; got: " + response.body());
  }

  @Test
  void testTranslateInvalidSqlReturnsBadRequest() throws Exception {
    HttpResponse<String> response = postSql(SQL_TRANSLATE_PATH, adminToken(), INVALID_SQL);
    assertEquals(
        400,
        response.statusCode(),
        "Unparseable SQL should yield 400 from /translate; got: " + response.body());
  }

  @Test
  void testQueryFormatParamSetsContentType() throws Exception {
    HttpResponse<String> response = postSqlWithFormat(adminToken(), VALID_SQL, CSV);

    assertEquals(200, response.statusCode(), "Valid SQL should execute; got: " + response.body());
    assertContentType(response, CSV);
  }

  private HttpResponse<String> postSql(String path, String token, String sql) throws Exception {
    return send(SdkClients.getServerUrl() + path, token, sql);
  }

  private HttpResponse<String> postSqlWithFormat(String token, String sql, String format)
      throws Exception {
    String url =
        SdkClients.getServerUrl()
            + SQL_QUERY_PATH
            + "?format="
            + URLEncoder.encode(format, StandardCharsets.UTF_8);
    return send(url, token, sql);
  }

  private HttpResponse<String> send(String url, String token, String sql) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", APPLICATION_JSON)
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.ofString(sql))
            .build();
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private static void assertContentType(HttpResponse<String> response, String expectedPrefix) {
    String contentType = response.headers().firstValue("Content-Type").orElse("");
    assertTrue(
        contentType.startsWith(expectedPrefix),
        "Expected Content-Type starting with '" + expectedPrefix + "' but got '" + contentType
            + "'");
    assertNotNull(response.body());
  }

  private static String adminToken() {
    return SdkClients.getAdminToken();
  }

  private static String nonAdminToken() {
    return JwtAuthProvider.tokenFor(
        "test@open-metadata.org", "test@open-metadata.org", new String[] {}, TOKEN_TTL_SECONDS);
  }
}
