package org.openmetadata.it.util;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.UUID;
import java.util.function.Consumer;
import org.awaitility.Awaitility;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;

/** Polls an entity's search document through the search API until an assertion on it passes. */
public final class SearchDocs {

  private static final Duration POLL_INTERVAL = Duration.ofMillis(500);
  private static final Duration TIMEOUT = Duration.ofSeconds(45);

  private SearchDocs() {}

  /**
   * Waits until {@code assertion} passes against the {@code index} document for {@code id}. When
   * checking what a write left behind, assert a marker of that write in the same assertion, so a
   * document read before the write lands cannot satisfy it.
   */
  public static void awaitDoc(String index, UUID id, Consumer<JsonNode> assertion) {
    String docPath = "/v1/search/get/" + index + "/doc/" + id;
    Awaitility.await(index + " doc " + id)
        .pollInterval(POLL_INTERVAL)
        .atMost(TIMEOUT)
        .untilAsserted(
            () ->
                assertion.accept(
                    JsonUtils.readTree(
                        SdkClients.adminClient()
                            .getHttpClient()
                            .executeForString(HttpMethod.GET, docPath, null))));
  }
}
