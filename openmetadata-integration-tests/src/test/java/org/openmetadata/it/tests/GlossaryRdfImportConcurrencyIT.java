/*
 *  Copyright 2024 Collate.
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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.SQLException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.ontology.RelationshipTypeIds;

@Isolated("Temporarily gates registry SQL and restores a shared predicate fixture")
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class GlossaryRdfImportConcurrencyIT {
  private static final ObjectMapper JSON = new ObjectMapper();
  private static final HttpClient HTTP = HttpClient.newHttpClient();
  private static final String RELATED = "http://www.w3.org/2004/02/skos/core#related";
  private final Set<UUID> typeIds = new LinkedHashSet<>();
  private RelationshipType savedRelated;

  enum Gate {
    AFTER_DISCOVERY("changed before completion"),
    AFTER_INSERT("changed before completion"),
    BEFORE_PARTNER_WRITE("changed while completing"),
    PARTNER_VALIDATION("could not be completed");

    final String message;

    Gate(String message) {
      this.message = message;
    }
  }

  @Test
  void claimAfterDiscoveryIsRejectedBeforeInsertion(TestNamespace ns) throws Exception {
    assertClaimAt(Gate.AFTER_DISCOVERY, ns);
  }

  @Test
  void claimAfterInsertionClearsThePersistedInverse(TestNamespace ns) throws Exception {
    assertClaimAt(Gate.AFTER_INSERT, ns);
  }

  @Test
  void claimBeforePartnerWriteIsNotOverwritten(TestNamespace ns) throws Exception {
    assertClaimAt(Gate.BEFORE_PARTNER_WRITE, ns);
  }

  @Test
  void partnerValidationFailureClearsTheNewInverse(TestNamespace ns) throws Exception {
    assertClaimAt(Gate.PARTNER_VALIDATION, ns);
  }

  private void assertClaimAt(Gate point, TestNamespace ns) throws Exception {
    String glossary = GlossaryTestFactory.createSimple(ns).getName();
    String forward = ns.shortPrefix("forward").replaceAll("[^a-zA-Z0-9]", "");
    String partner = ns.shortPrefix("partner").replaceAll("[^a-zA-Z0-9]", "");
    String winner = ns.shortPrefix("winner").replaceAll("[^a-zA-Z0-9]", "");
    typeIds.add(RelationshipTypeIds.stableId(forward));
    JsonNode before = createType(glossary, partner);
    JsonNode claimed = createType(glossary, winner);
    AtomicBoolean inserted = new AtomicBoolean();
    AtomicBoolean fired = new AtomicBoolean();
    var jdbi = Entity.getJdbi();
    SqlLogger previous = jdbi.getConfig(SqlStatements.class).getSqlLogger();
    jdbi.setSqlLogger(
        new SqlLogger() {
          @Override
          public void logBeforeExecution(StatementContext context) {
            previous.logBeforeExecution(context);
          }

          @Override
          public void logException(StatementContext context, SQLException exception) {
            previous.logException(context, exception);
          }

          @Override
          public void logAfterExecution(StatementContext context) {
            previous.logAfterExecution(context);
            var request = RequestLatencyContext.getContext();
            if (request == null
                || request.getUriPath() == null
                || !request.getUriPath().contains(glossary)) return;
            String sql = context.getRenderedSql().toLowerCase(Locale.ROOT);
            boolean typeInsert = sql.contains("insert into relationship_type_entity");
            if (typeInsert) inserted.set(true);
            boolean partnerRead =
                sql.contains("relationship_type_entity")
                    && sql.contains("rdfpredicate")
                    && context.getBinding().toString().contains("#" + partner);
            boolean matches =
                switch (point) {
                  case AFTER_DISCOVERY -> partnerRead && !inserted.get();
                  case AFTER_INSERT -> typeInsert;
                  case BEFORE_PARTNER_WRITE, PARTNER_VALIDATION -> partnerRead && inserted.get();
                };
            if (matches && fired.compareAndSet(false, true)) {
              if (point == Gate.PARTNER_VALIDATION)
                throw new jakarta.ws.rs.BadRequestException("Injected partner validation failure");
              try {
                JsonNode edited =
                    exchange(
                        "PATCH",
                        "/v1/relationshipTypes/" + before.path("id").asText(),
                        claimPatch(claimed),
                        "application/json-patch+json",
                        200);
                assertTrue(
                    edited.path("version").asDouble() > before.path("version").asDouble(),
                    "The competing PATCH must advance the version");
              } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException(exception);
              } catch (IOException exception) {
                throw new UncheckedIOException(exception);
              }
            }
          }
        });
    JsonNode result;
    try {
      result =
          exchange(
              "PUT",
              "/v1/glossaries/name/" + glossary + "/importRdf?dryRun=false&format=turtle",
              ontology(glossary, forward, partner),
              "text/turtle",
              200);
    } finally {
      jdbi.setSqlLogger(previous);
    }
    assertTrue(fired.get(), "The requested SQL boundary must be exercised: " + point);
    assertEquals(3, result.path("relationsAdded").asInt(), result.toString());
    JsonNode current = type(partner);
    JsonNode created = type(forward);
    if (point == Gate.PARTNER_VALIDATION) {
      assertTrue(current.path("inverse").isMissingNode());
      assertEquals("Original description", current.path("description").asText());
    } else {
      assertEquals(winner, current.path("inverse").path("name").asText());
      assertEquals("Edited concurrently", current.path("description").asText());
      assertEquals("BLUE", current.path("paletteKey").asText());
    }
    assertTrue(result.path("messages").toString().contains(partner), result.toString());
    assertTrue(result.path("messages").toString().contains(point.message), result.toString());
    assertTrue(
        created.path("inverse").isMissingNode(), "The losing new type must not retain its inverse");
    assertEquals(point == Gate.AFTER_DISCOVERY ? 0.1 : 0.2, created.path("version").asDouble());
    for (int index = 0; index < 3; index++) {
      JsonNode term =
          exchange(
              "GET",
              "/v1/glossaryTerms/name/" + glossary + ".T" + index + "?fields=relatedTerms",
              null,
              "application/json",
              200);
      assertEquals(2, term.path("relatedTerms").size());
      for (JsonNode relation : term.path("relatedTerms"))
        assertEquals(forward, relation.path("relationType").asText());
    }
  }

  @Test
  void importReusesAnInBatchInversePredicate(TestNamespace ns) throws Exception {
    var dao = Entity.getCollectionDAO().relationshipTypeDAO();
    String existing = dao.findByPredicate(RELATED);
    if (existing != null) {
      savedRelated = JsonUtils.readValue(existing, RelationshipType.class);
      dao.delete(savedRelated.getId());
      EntityRepository.invalidateCacheForEntity(
          Entity.RELATIONSHIP_TYPE, savedRelated.getId(), savedRelated.getFullyQualifiedName());
    }
    String glossary = GlossaryTestFactory.createSimple(ns).getName();
    String mirrors = ns.shortPrefix("mirrors").replaceAll("[^a-zA-Z0-9]", "");
    for (String name : List.of("skosRelated", "related", mirrors))
      typeIds.add(RelationshipTypeIds.stableId(name));
    String rdf =
        ontology(glossary, mirrors, "unused")
                .replace(
                    "p:" + mirrors + " a owl:ObjectProperty ; owl:inverseOf p:unused .",
                    "p:" + mirrors + " a owl:ObjectProperty ; owl:inverseOf skos:related .")
            + "p:T0 skos:related p:T1 .\n";
    JsonNode result =
        exchange(
            "PUT",
            "/v1/glossaries/name/" + glossary + "/importRdf?dryRun=false&format=turtle",
            rdf,
            "text/turtle",
            200);
    JsonNode types =
        exchange("GET", "/v1/relationshipTypes?limit=1000", null, "application/json", 200);
    List<String> names = new ArrayList<>();
    for (JsonNode type : types.path("data"))
      if (RELATED.equals(type.path("rdfPredicate").asText())) names.add(type.path("name").asText());
    assertEquals(List.of("skosRelated"), names);
    assertEquals(2, result.path("relationTypesRegistered").asInt(), result.toString());
    assertEquals(mirrors, type("skosRelated").path("inverse").path("name").asText());
    assertEquals("skosRelated", type(mirrors).path("inverse").path("name").asText());
  }

  @AfterEach
  void cleanup(TestNamespace ns) throws Exception {
    try {
      NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
    } finally {
      try {
        List<String> failures = new ArrayList<>();
        for (UUID id : typeIds) {
          HttpResponse<String> current =
              request("GET", "/v1/relationshipTypes/" + id, null, "application/json");
          if (current.statusCode() == 200 && JSON.readTree(current.body()).hasNonNull("inverse")) {
            HttpResponse<String> cleared =
                request(
                    "PATCH",
                    "/v1/relationshipTypes/" + id,
                    "[{\"op\":\"remove\",\"path\":\"/inverse\"}]",
                    "application/json-patch+json");
            if (cleared.statusCode() != 200) failures.add(cleared.body());
          }
        }
        for (UUID id : typeIds) {
          if (savedRelated != null && id.equals(savedRelated.getId())) {
            var dao = Entity.getCollectionDAO().relationshipTypeDAO();
            if (dao.listActive().stream()
                .anyMatch(
                    json -> id.equals(JsonUtils.readValue(json, RelationshipType.class).getId())))
              dao.delete(id);
          } else {
            HttpResponse<String> response =
                request(
                    "DELETE",
                    "/v1/relationshipTypes/" + id + "?hardDelete=true",
                    null,
                    "application/json");
            if (response.statusCode() != 200 && response.statusCode() != 404)
              failures.add(response.body());
          }
        }
        assertTrue(failures.isEmpty(), failures.toString());
      } finally {
        if (savedRelated != null) {
          Entity.getCollectionDAO()
              .relationshipTypeDAO()
              .insert(savedRelated, savedRelated.getFullyQualifiedName());
          EntityRepository.invalidateCacheForEntity(
              Entity.RELATIONSHIP_TYPE, savedRelated.getId(), savedRelated.getFullyQualifiedName());
        }
      }
    }
  }

  private String claimPatch(JsonNode type) throws IOException {
    var reference =
        JSON.createObjectNode()
            .put("id", type.path("id").asText())
            .put("name", type.path("name").asText())
            .put("fullyQualifiedName", type.path("name").asText())
            .put("type", "relationshipType");
    return "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"Edited concurrently\"},{\"op\":\"replace\",\"path\":\"/paletteKey\",\"value\":\"BLUE\"},{\"op\":\"add\",\"path\":\"/inverse\",\"value\":"
        + JSON.writeValueAsString(reference)
        + "}]";
  }

  private JsonNode type(String name) throws IOException, InterruptedException {
    return exchange("GET", "/v1/relationshipTypes/name/" + name, null, "application/json", 200);
  }

  private JsonNode createType(String glossary, String name)
      throws IOException, InterruptedException {
    JsonNode result =
        exchange(
            "POST",
            "/v1/relationshipTypes",
            "{\"name\":\""
                + name
                + "\",\"displayName\":\""
                + name
                + "\",\"description\":\"Original description\",\"rdfPredicate\":\"http://example.org/"
                + glossary
                + "#"
                + name
                + "\",\"category\":\"CUSTOM\",\"paletteKey\":\"VIOLET\"}",
            "application/json",
            201);
    typeIds.add(UUID.fromString(result.path("id").asText()));
    return result;
  }

  protected JsonNode exchange(
      String method, String path, String body, String contentType, int status)
      throws IOException, InterruptedException {
    HttpResponse<String> response = request(method, path, body, contentType);
    assertEquals(status, response.statusCode(), response.body());
    return response.body().isBlank() ? JSON.createObjectNode() : JSON.readTree(response.body());
  }

  private HttpResponse<String> request(String method, String path, String body, String contentType)
      throws IOException, InterruptedException {
    return HTTP.send(
        HttpRequest.newBuilder(URI.create(SdkClients.getServerUrl() + path))
            .timeout(Duration.ofSeconds(100))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", contentType)
            .method(
                method,
                body == null
                    ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofString(body))
            .build(),
        HttpResponse.BodyHandlers.ofString());
  }

  private String ontology(String glossary, String forward, String partner) {
    return "@prefix skos: <http://www.w3.org/2004/02/skos/core#> .\n@prefix owl: <http://www.w3.org/2002/07/owl#> .\n@prefix p: <http://example.org/"
        + glossary
        + "#> .\n"
        + "p:T0 a skos:Concept ; p:"
        + forward
        + " p:T1 .\np:T1 a skos:Concept ; p:"
        + forward
        + " p:T2 .\np:T2 a skos:Concept ; p:"
        + forward
        + " p:T0 .\n"
        + "p:"
        + forward
        + " a owl:ObjectProperty ; owl:inverseOf p:"
        + partner
        + " .\n";
  }
}
