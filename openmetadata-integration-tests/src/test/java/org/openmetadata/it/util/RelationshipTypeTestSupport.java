/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.RelationshipPaletteKey;
import org.openmetadata.schema.type.RelationshipTypeCategory;
import org.openmetadata.schema.utils.JsonUtils;

/** Raw-HTTP helpers for relationship types and the glossary term relations that use them. */
public final class RelationshipTypeTestSupport {
  public static final String TYPES = "/v1/relationshipTypes";
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();
  private static final String JSON = "application/json";
  private static final String JSON_PATCH = "application/json-patch+json";

  /** One HTTP exchange: its status and parsed body. */
  public record Reply(int status, JsonNode body) {
    public String message() {
      return body.path("message").asText(body.toString());
    }
  }

  private RelationshipTypeTestSupport() {}

  public static RelationshipType createType(String name, String inverseName) {
    Reply reply = send("POST", TYPES, typeRequest(name, inverseName).toString());
    assertEquals(201, reply.status(), reply.message());
    return asType(reply);
  }

  public static RelationshipType asType(Reply reply) {
    assertTrue(reply.status() < 300, reply.message());
    return JsonUtils.readValue(reply.body().toString(), RelationshipType.class);
  }

  /** Creates the two types as each other's inverse. */
  public static List<RelationshipType> createInversePair(String first, String second) {
    createType(first, null);
    RelationshipType secondType = createType(second, first);
    Reply reply = send("PUT", TYPES, typeRequest(first, second).toString());
    assertEquals(200, reply.status(), reply.message());
    return List.of(asType(reply), secondType);
  }

  public static ObjectNode typeRequest(String name, String inverseName) {
    String predicate = "https://example.org/relationship-type-it/" + name;
    ObjectNode request =
        MAPPER
            .createObjectNode()
            .put("name", name)
            .put("displayName", name)
            .put("description", "Relationship type " + name)
            .put("iri", predicate)
            .put("rdfPredicate", predicate)
            .put("category", RelationshipTypeCategory.CUSTOM.value())
            .put("paletteKey", RelationshipPaletteKey.VIOLET.value());
    request.set("characteristics", MAPPER.createArrayNode());
    if (inverseName != null) {
      request.put("inverse", inverseName);
    }
    return request;
  }

  /** The name the type's stored inverse refers to, or null when it has none. */
  public static String inverseOf(UUID id) {
    JsonNode inverse = getType(id).body().path("inverse");
    return inverse.isObject() ? inverse.path("fullyQualifiedName").asText(null) : null;
  }

  /** The change events recorded for a relationship type since {@code timestamp}. */
  public static List<JsonNode> updateEventsSince(UUID id, long timestamp) {
    Reply reply =
        send("GET", "/v1/events?entityUpdated=relationshipType&timestamp=" + timestamp, null);
    assertEquals(200, reply.status(), reply.message());
    List<JsonNode> events = new ArrayList<>();
    reply
        .body()
        .path("data")
        .forEach(
            event -> {
              if (id.toString().equals(event.path("entityId").asText())) {
                events.add(event);
              }
            });
    return events;
  }

  public static Reply putType(ObjectNode request) {
    return send("PUT", TYPES, request.toString());
  }

  public static Reply deleteType(UUID id, boolean hardDelete) {
    return send("DELETE", TYPES + "/" + id + "?hardDelete=" + hardDelete, null);
  }

  /**
   * Hard-deletes the given types, tolerating ones already gone. Deleting one half of an unused
   * inverse pair clears the other half's inverse, so the order does not matter.
   */
  public static void hardDeleteAll(Collection<UUID> ids) {
    for (UUID id : ids) {
      Reply reply = deleteType(id, true);
      assertTrue(reply.status() == 200 || reply.status() == 404, reply.message());
    }
  }

  public static Reply restoreType(UUID id) {
    return send(
        "PUT", TYPES + "/restore", MAPPER.createObjectNode().put("id", id.toString()).toString());
  }

  public static Reply getType(UUID id) {
    return send("GET", TYPES + "/" + id + "?include=all", null);
  }

  public static Reply getTypeByName(String name) {
    return send("GET", TYPES + "/name/" + name + "?include=all", null);
  }

  public static UUID createTerm(Glossary glossary, String name) {
    ObjectNode request =
        MAPPER
            .createObjectNode()
            .put("name", name)
            .put("description", name)
            .put("glossary", glossary.getFullyQualifiedName());
    Reply reply = send("POST", "/v1/glossaryTerms", request.toString());
    assertEquals(201, reply.status(), reply.message());
    return UUID.fromString(reply.body().path("id").asText());
  }

  public static Reply relate(UUID from, UUID to, String relationType) {
    ObjectNode relation = MAPPER.createObjectNode().put("relationType", relationType);
    relation.set(
        "term", MAPPER.createObjectNode().put("id", to.toString()).put("type", "glossaryTerm"));
    return send("POST", "/v1/glossaryTerms/" + from + "/relations", relation.toString());
  }

  public static Reply unrelate(UUID from, UUID to, String relationType) {
    return send(
        "DELETE",
        "/v1/glossaryTerms/" + from + "/relations/" + to + "?relationType=" + relationType,
        null);
  }

  /** By-id read and an edit of each term, then the term list and the ontology export. */
  public static List<Reply> relationReads(Glossary glossary, UUID... terms) {
    List<Reply> replies = new ArrayList<>();
    for (UUID term : terms) {
      replies.add(send("GET", "/v1/glossaryTerms/" + term + "?fields=relatedTerms", null));
      replies.add(
          send(
              "PATCH",
              "/v1/glossaryTerms/" + term,
              "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"edited "
                  + UUID.randomUUID()
                  + "\"}]"));
    }
    replies.add(
        send(
            "GET",
            "/v1/glossaryTerms?glossary=" + glossary.getId() + "&fields=relatedTerms&limit=100",
            null));
    replies.add(
        send("GET", "/v1/glossaries/" + glossary.getId() + "/exportOntology?format=turtle", null));
    return replies;
  }

  /**
   * Imports two concepts related through {@code first} and its declared inverse {@code second}.
   * The importer writes named inverse references, so relation reads follow the inverse and one
   * direction is stored as {@code second}; REST-created pairs carry no names and never invert.
   */
  public static List<UUID> importInversePair(Glossary glossary, String first, String second) {
    String turtle =
        "@prefix skos: <http://www.w3.org/2004/02/skos/core#> .\n"
            + "@prefix owl: <http://www.w3.org/2002/07/owl#> .\n"
            + "@prefix x: <http://example.org/"
            + UUID.randomUUID()
            + "#> .\n"
            + "x:T0 a skos:Concept ; skos:prefLabel \"T0\" .\n"
            + "x:T1 a skos:Concept ; skos:prefLabel \"T1\" .\n"
            + "x:T0 x:"
            + first
            + " x:T1 .\nx:T1 x:"
            + second
            + " x:T0 .\n"
            + "x:"
            + first
            + " a owl:ObjectProperty ; owl:inverseOf x:"
            + second
            + " .\nx:"
            + second
            + " a owl:ObjectProperty ; owl:inverseOf x:"
            + first
            + " .\n";
    Reply reply =
        send(
            "PUT",
            "/v1/glossaries/name/"
                + glossary.getFullyQualifiedName()
                + "/importRdf?dryRun=false&format=turtle",
            turtle,
            "text/turtle");
    assertEquals(200, reply.status(), reply.message());
    return List.of(termId(glossary, "T0"), termId(glossary, "T1"));
  }

  /**
   * A unique type name usable both as a term relation type, which must start with a letter and
   * hold only letters and digits, and as an RDF predicate's local name, which the importer keeps.
   */
  public static String relationTypeName(TestNamespace ns, String base) {
    return base + ns.shortPrefix(base).replaceAll("[^A-Za-z0-9]", "");
  }

  private static UUID termId(Glossary glossary, String name) {
    Reply reply =
        send(
            "GET", "/v1/glossaryTerms/name/" + glossary.getFullyQualifiedName() + "." + name, null);
    assertEquals(200, reply.status(), reply.message());
    return UUID.fromString(reply.body().path("id").asText());
  }

  /** The relation types a term shows towards {@code other}, as its relatedTerms read returns them. */
  public static List<String> relationTypesTowards(UUID term, UUID other) {
    Reply reply = send("GET", "/v1/glossaryTerms/" + term + "?fields=relatedTerms", null);
    assertEquals(200, reply.status(), reply.message());
    List<String> types = new ArrayList<>();
    reply
        .body()
        .path("relatedTerms")
        .forEach(
            relation -> {
              if (other.toString().equals(relation.path("term").path("id").asText())) {
                types.add(relation.path("relationType").asText());
              }
            });
    return types.stream().sorted().toList();
  }

  public static Reply send(String method, String path, String body) {
    return send(method, path, body, "PATCH".equals(method) ? JSON_PATCH : JSON);
  }

  private static Reply send(String method, String path, String body, String contentType) {
    HttpRequest request =
        HttpRequest.newBuilder(URI.create(SdkClients.getServerUrl() + path))
            .timeout(Duration.ofSeconds(90))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", contentType)
            .method(
                method,
                body == null
                    ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofString(body))
            .build();
    try {
      HttpResponse<String> response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
      return new Reply(response.statusCode(), parse(response.body()));
    } catch (IOException exception) {
      throw new IllegalStateException(method + " " + path + " failed", exception);
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException(method + " " + path + " was interrupted", exception);
    }
  }

  private static JsonNode parse(String body) {
    try {
      return MAPPER.readTree(body);
    } catch (IOException exception) {
      return MAPPER.getNodeFactory().textNode(body);
    }
  }
}
