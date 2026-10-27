package org.openmetadata.it.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import java.time.Duration;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import org.awaitility.Awaitility;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;

/** Reads raw search documents, for ITs that check what a write left in the index. */
public final class SearchDocs {

  private SearchDocs() {}

  /**
   * Polls the {@code index} document of {@code id} until {@code written} holds. Make {@code written}
   * recognise the write under test (a value that write changed), so that the checks which follow
   * see that write and not an older version of the document.
   */
  public static JsonNode awaitDoc(String index, UUID id, Predicate<JsonNode> written) {
    String docPath = "/v1/search/get/" + index + "/doc/" + id;
    return Awaitility.await(index + " doc " + id)
        .pollInterval(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(60))
        .ignoreExceptionsInstanceOf(OpenMetadataException.class)
        .until(
            () ->
                JsonUtils.readTree(
                    SdkClients.adminClient()
                        .getHttpClient()
                        .executeForString(HttpMethod.GET, docPath, null)),
            written);
  }

  /** Polls until the {@code index} document of {@code id} is gone. */
  public static void awaitNoDoc(String index, UUID id) {
    String docPath = "/v1/search/get/" + index + "/doc/" + id;
    Awaitility.await(index + " doc " + id + " removed")
        .pollInterval(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(60))
        .until(
            () -> {
              try {
                SdkClients.adminClient()
                    .getHttpClient()
                    .executeForString(HttpMethod.GET, docPath, null);
                return false;
              } catch (OpenMetadataException e) {
                return e.getStatusCode() == 404;
              }
            });
  }

  public static Set<String> fieldValues(JsonNode array, String field) {
    Set<String> values = new HashSet<>();
    array.forEach(node -> values.add(node.path(field).asText()));
    return values;
  }

  public static Set<String> textValues(JsonNode array) {
    Set<String> values = new HashSet<>();
    array.forEach(node -> values.add(node.asText()));
    return values;
  }

  /** Tag FQNs in the document's top-level {@code tags}. */
  public static Set<String> tagFqns(JsonNode doc) {
    return fieldValues(doc.path("tags"), "tagFQN");
  }

  /** Tag FQNs on the element of {@code elements} (columns, fields, features) named {@code name}. */
  public static Set<String> tagFqnsOf(JsonNode elements, String name) {
    Set<String> tagFqns = new HashSet<>();
    elements.forEach(
        element -> {
          if (name.equals(element.path("name").asText())) {
            tagFqns.addAll(fieldValues(element.path("tags"), "tagFQN"));
          }
        });
    return tagFqns;
  }

  /** The tag label with {@code tagFqn} on the element of {@code elements} named {@code name}. */
  public static JsonNode tagOf(JsonNode elements, String name, String tagFqn) {
    for (JsonNode element : elements) {
      if (name.equals(element.path("name").asText())) {
        return findTag(element.path("tags"), tagFqn);
      }
    }
    return MissingNode.getInstance();
  }

  /** The tag label with {@code tagFqn} in {@code tags}, or a missing node. */
  public static JsonNode findTag(JsonNode tags, String tagFqn) {
    for (JsonNode tag : tags) {
      if (tagFqn.equals(tag.path("tagFQN").asText())) {
        return tag;
      }
    }
    return MissingNode.getInstance();
  }

  /** The reference to {@code id} in the reference list {@code refs}, or a missing node. */
  public static JsonNode refOf(JsonNode refs, UUID id) {
    for (JsonNode ref : refs) {
      if (id.toString().equals(ref.path("id").asText())) {
        return ref;
      }
    }
    return MissingNode.getInstance();
  }
}
