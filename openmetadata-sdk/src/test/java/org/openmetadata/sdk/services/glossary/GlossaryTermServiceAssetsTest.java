package org.openmetadata.sdk.services.glossary;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.network.OpenMetadataHttpClient;

/**
 * Exercises {@link GlossaryTermService#assets} against a real local HTTP server, so the request
 * OkHttp builds is checked rather than the overload a mocked client accepts.
 */
class GlossaryTermServiceAssetsTest {

  private static final UUID TERM_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private static final UUID ASSET_ID = UUID.fromString("00000000-0000-0000-0000-000000000002");
  private static final String ASSETS_BODY =
      "{\"data\":[{\"id\":\"" + ASSET_ID + "\",\"type\":\"table\"}],\"paging\":{\"total\":1}}";

  private HttpServer server;
  private final List<ReceivedRequest> received = new CopyOnWriteArrayList<>();

  @BeforeEach
  void startServer() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/api/v1/glossaryTerms", this::recordAndRespond);
    server.start();
  }

  @AfterEach
  void stopServer() {
    server.stop(0);
  }

  @Test
  void assetsSendsABodylessGetWithPagingAsQueryParameters() {
    GlossaryTermService service =
        new GlossaryTermService(
            new OpenMetadataHttpClient(
                OpenMetadataConfig.builder()
                    .baseUrl("http://127.0.0.1:" + server.getAddress().getPort() + "/api")
                    .build()));

    ResultList<EntityReference> assets = service.assets(TERM_ID, 25, 50);

    assertEquals(1, received.size());
    ReceivedRequest request = received.getFirst();
    assertEquals("GET", request.method());
    assertEquals("/api/v1/glossaryTerms/" + TERM_ID + "/assets", request.path());
    assertEquals(List.of("limit=25", "offset=50"), sortedQuery(request.query()));
    assertEquals(0, request.bodyLength());
    assertEquals(1, assets.getData().size());
    assertEquals(ASSET_ID, assets.getData().getFirst().getId());
  }

  private void recordAndRespond(HttpExchange exchange) throws IOException {
    try (InputStream body = exchange.getRequestBody()) {
      received.add(
          new ReceivedRequest(
              exchange.getRequestMethod(),
              exchange.getRequestURI().getPath(),
              exchange.getRequestURI().getRawQuery(),
              body.readAllBytes().length));
    }
    byte[] bytes = ASSETS_BODY.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().add("Content-Type", "application/json");
    exchange.sendResponseHeaders(200, bytes.length);
    try (OutputStream out = exchange.getResponseBody()) {
      out.write(bytes);
    }
  }

  private static List<String> sortedQuery(String query) {
    return query == null ? List.of() : List.of(query.split("&")).stream().sorted().toList();
  }

  private record ReceivedRequest(String method, String path, String query, int bodyLength) {}
}
