package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.charset.StandardCharsets;
import org.apache.http.HttpHost;
import org.apache.http.HttpRequest;
import org.apache.http.entity.StringEntity;
import org.apache.http.message.BasicHttpEntityEnclosingRequest;
import org.apache.http.message.BasicHttpRequest;
import org.apache.http.protocol.BasicHttpContext;
import org.apache.http.protocol.HttpContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;

class SigV4RequestSigningInterceptorTest {

  private AwsCredentialsProvider credentialsProvider;
  private SigV4RequestSigningInterceptor interceptor;

  @BeforeEach
  void setUp() {
    credentialsProvider =
        StaticCredentialsProvider.create(
            AwsBasicCredentials.create(
                "AKIAIOSFODNN7EXAMPLE", "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"));
    interceptor = new SigV4RequestSigningInterceptor(credentialsProvider, Region.US_EAST_1, "es");
  }

  @Test
  void testInterceptorAddsAuthorizationHeader() throws Exception {
    HttpRequest request = new BasicHttpRequest("GET", "/_cluster/health");
    HttpContext context = createHttpContext("search.us-east-1.es.amazonaws.com", 443, "https");

    interceptor.process(request, context);

    assertTrue(request.containsHeader("Authorization"));
    assertTrue(request.containsHeader("X-Amz-Date"));
    assertTrue(request.containsHeader("Host"));

    String authHeader = request.getFirstHeader("Authorization").getValue();
    assertTrue(authHeader.startsWith("AWS4-HMAC-SHA256"));
    assertTrue(authHeader.contains("Credential=AKIAIOSFODNN7EXAMPLE"));
    assertTrue(authHeader.contains("SignedHeaders="));
  }

  @Test
  void testInterceptorWithPostRequest() throws Exception {
    BasicHttpEntityEnclosingRequest request =
        new BasicHttpEntityEnclosingRequest("POST", "/test-index/_search");
    String jsonBody = "{\"query\":{\"match_all\":{}}}";
    request.setEntity(new StringEntity(jsonBody, StandardCharsets.UTF_8));
    HttpContext context = createHttpContext("search.us-east-1.es.amazonaws.com", 443, "https");

    interceptor.process(request, context);

    assertTrue(request.containsHeader("Authorization"));
    assertTrue(request.containsHeader("X-Amz-Date"));

    assertNotNull(request.getEntity());
  }

  @Test
  void testInterceptorWithQueryParameters() throws Exception {
    HttpRequest request = new BasicHttpRequest("GET", "/_search?q=test&size=10");
    HttpContext context = createHttpContext("search.us-east-1.es.amazonaws.com", 443, "https");

    interceptor.process(request, context);

    assertTrue(request.containsHeader("Authorization"));
  }

  @Test
  void testInterceptorWithDifferentRegion() throws Exception {
    SigV4RequestSigningInterceptor euInterceptor =
        new SigV4RequestSigningInterceptor(credentialsProvider, Region.EU_WEST_1, "es");

    HttpRequest request = new BasicHttpRequest("GET", "/_cluster/health");
    HttpContext context = createHttpContext("search.eu-west-1.es.amazonaws.com", 443, "https");

    euInterceptor.process(request, context);

    String authHeader = request.getFirstHeader("Authorization").getValue();
    assertTrue(authHeader.contains("eu-west-1"));
  }

  @Test
  void testInterceptorWithOpenSearchServerless() throws Exception {
    SigV4RequestSigningInterceptor aossInterceptor =
        new SigV4RequestSigningInterceptor(credentialsProvider, Region.US_EAST_1, "aoss");

    HttpRequest request = new BasicHttpRequest("GET", "/_cluster/health");
    HttpContext context = createHttpContext("abc123.us-east-1.aoss.amazonaws.com", 443, "https");

    aossInterceptor.process(request, context);

    String authHeader = request.getFirstHeader("Authorization").getValue();
    assertTrue(authHeader.contains("aoss"));
  }

  @Test
  void testInterceptorSkipsSigningWhenNoTargetHost() throws Exception {
    HttpRequest request = new BasicHttpRequest("GET", "/_cluster/health");
    HttpContext context = new BasicHttpContext();

    interceptor.process(request, context);

    assertFalse(request.containsHeader("Authorization"));
  }

  @Test
  void testInterceptorWithPutRequest() throws Exception {
    BasicHttpEntityEnclosingRequest request =
        new BasicHttpEntityEnclosingRequest("PUT", "/test-index");
    String jsonBody = "{\"settings\":{\"number_of_shards\":1}}";
    request.setEntity(new StringEntity(jsonBody, StandardCharsets.UTF_8));
    HttpContext context = createHttpContext("search.us-east-1.es.amazonaws.com", 443, "https");

    interceptor.process(request, context);

    assertTrue(request.containsHeader("Authorization"));
    assertNotNull(request.getEntity());
  }

  @Test
  void testInterceptorWithDeleteRequest() throws Exception {
    HttpRequest request = new BasicHttpRequest("DELETE", "/test-index");
    HttpContext context = createHttpContext("search.us-east-1.es.amazonaws.com", 443, "https");

    interceptor.process(request, context);

    assertTrue(request.containsHeader("Authorization"));
  }

  @Test
  void testInterceptorPreservesExistingHeaders() throws Exception {
    HttpRequest request = new BasicHttpRequest("GET", "/_cluster/health");
    request.addHeader("X-Custom-Header", "custom-value");
    HttpContext context = createHttpContext("search.us-east-1.es.amazonaws.com", 443, "https");

    interceptor.process(request, context);

    assertTrue(request.containsHeader("Authorization"));
  }

  @Test
  void testInterceptorExcludesTransferEncodingFromSignedHeaders() throws Exception {
    BasicHttpEntityEnclosingRequest request =
        new BasicHttpEntityEnclosingRequest("POST", "/_bulk?refresh=false");
    String bulkBody = "{\"index\":{\"_index\":\"test\"}}\n{\"field\":\"value\"}\n";
    request.setEntity(new StringEntity(bulkBody, StandardCharsets.UTF_8));
    request.addHeader("Transfer-Encoding", "chunked");
    HttpContext context = createHttpContext("search.eu-west-3.es.amazonaws.com", 443, "https");

    interceptor.process(request, context);

    assertTrue(request.containsHeader("Authorization"));
    String authHeader = request.getFirstHeader("Authorization").getValue();
    String signedHeadersPart = authHeader.substring(authHeader.indexOf("SignedHeaders="));
    assertFalse(
        signedHeadersPart.toLowerCase().contains("transfer-encoding"),
        "transfer-encoding should NOT be in SignedHeaders to avoid AWS SigV4 mismatch errors");
  }

  @Test
  void testBulkRequestWithChunkedEncodingSucceeds() throws Exception {
    BasicHttpEntityEnclosingRequest request =
        new BasicHttpEntityEnclosingRequest("POST", "/_bulk?refresh=false");
    String bulkBody =
        "{\"index\":{\"_index\":\"table_search_index\",\"_id\":\"123\"}}\n"
            + "{\"id\":\"123\",\"name\":\"test_table\",\"deleted\":false}\n";
    request.setEntity(new StringEntity(bulkBody, StandardCharsets.UTF_8));
    request.addHeader("Transfer-Encoding", "chunked");
    request.addHeader("Content-Type", "application/x-ndjson");
    HttpContext context =
        createHttpContext("vpc-saas-test-engg.eu-west-3.es.amazonaws.com", 443, "https");

    SigV4RequestSigningInterceptor euInterceptor =
        new SigV4RequestSigningInterceptor(credentialsProvider, Region.EU_WEST_3, "es");
    euInterceptor.process(request, context);

    assertTrue(request.containsHeader("Authorization"));
    assertTrue(request.containsHeader("X-Amz-Date"));
    String authHeader = request.getFirstHeader("Authorization").getValue();
    assertTrue(authHeader.contains("eu-west-3"));
    assertFalse(
        authHeader.toLowerCase().contains("transfer-encoding"),
        "Bulk reindex requests must not sign transfer-encoding header");
  }

  private HttpContext createHttpContext(String hostname, int port, String scheme) {
    HttpContext context = new BasicHttpContext();
    context.setAttribute("http.target_host", new HttpHost(hostname, port, scheme));
    return context;
  }
}
