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
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.SQLException;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.awaitility.Awaitility;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.service.Entity;
import org.openmetadata.service.monitoring.RequestLatencyContext;

@EnabledIfSystemProperty(named = "databaseType", matches = "mysql")
@Isolated("Temporarily gates the relationship registry SQL logger")
public class GlossaryRdfImportConcurrencyIT {
  private static final ObjectMapper JSON = new ObjectMapper();
  private static final HttpClient HTTP = HttpClient.newHttpClient();

  @Test
  void importClearsNewInverseWhenExistingPartnerIsClaimedAfterDiscovery() throws Exception {
    String glossary = "claim" + UUID.randomUUID().toString().replace("-", "");
    String forward = glossary + "A";
    String partner = glossary + "B";
    String winner = glossary + "C";
    String gate = "gate" + glossary;
    exchange(
        "POST",
        "/v1/glossaries",
        "{\"name\":\"" + glossary + "\",\"description\":\"Concurrent import\"}",
        "application/json",
        201);
    JsonNode before = createType(glossary, partner);
    JsonNode claimed = createType(glossary, winner);
    var jdbi = Entity.getJdbi();
    SqlLogger previous = jdbi.getConfig(SqlStatements.class).getSqlLogger();
    CountDownLatch discovered = new CountDownLatch(1);
    CountDownLatch edited = new CountDownLatch(1);
    AtomicBoolean paused = new AtomicBoolean();
    CompletableFuture<JsonNode> imported = null;
    try (var holder = jdbi.open()) {
      assertEquals(
          1,
          holder
              .createQuery("SELECT GET_LOCK(:gate, 10)")
              .bind("gate", gate)
              .mapTo(Integer.class)
              .one());
      holder.execute(
          "CREATE TRIGGER "
              + gate
              + " BEFORE INSERT ON relationship_type_entity FOR EACH ROW BEGIN IF JSON_UNQUOTE(JSON_EXTRACT(NEW.json, '$.name')) = '"
              + forward
              + "' THEN SET @claim_gate = GET_LOCK('"
              + gate
              + "', 60); SET @claim_gate = RELEASE_LOCK('"
              + gate
              + "'); END IF; END");
      jdbi.setSqlLogger(
          new SqlLogger() {
            @Override
            public void logBeforeExecution(StatementContext context) {
              previous.logBeforeExecution(context);
            }

            @Override
            public void logAfterExecution(StatementContext context) {
              previous.logAfterExecution(context);
              var request = RequestLatencyContext.getContext();
              if (request != null
                  && request.getUriPath() != null
                  && request.getUriPath().contains(glossary)
                  && context
                      .getRenderedSql()
                      .contains("JSON_UNQUOTE(JSON_EXTRACT(json, '$.rdfPredicate'))")
                  && paused.compareAndSet(false, true)) {
                discovered.countDown();
                try {
                  assertTrue(edited.await(40, TimeUnit.SECONDS), "Concurrent claim must complete");
                } catch (InterruptedException exception) {
                  Thread.currentThread().interrupt();
                  throw new AssertionError(exception);
                }
              }
            }

            @Override
            public void logException(StatementContext context, SQLException exception) {
              previous.logException(context, exception);
            }
          });
      imported =
          CompletableFuture.supplyAsync(
              () -> {
                try {
                  return exchange(
                      "PUT",
                      "/v1/glossaries/name/" + glossary + "/importRdf?dryRun=false&format=turtle",
                      ontology(glossary, forward, partner),
                      "text/turtle",
                      200);
                } catch (InterruptedException exception) {
                  Thread.currentThread().interrupt();
                  throw new CompletionException(exception);
                } catch (IOException exception) {
                  throw new CompletionException(exception);
                }
              });
      try {
        assertTrue(
            discovered.await(40, TimeUnit.SECONDS), "Import must capture its registry snapshot");
        String patch =
            "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"Edited concurrently\"},{\"op\":\"replace\",\"path\":\"/paletteKey\",\"value\":\"BLUE\"},{\"op\":\"add\",\"path\":\"/inverse\",\"value\":"
                + claimedReference(claimed)
                + "}]";
        exchange(
            "PATCH",
            "/v1/relationshipTypes/" + before.path("id").asText(),
            patch,
            "application/json-patch+json",
            200);
        edited.countDown();
        Awaitility.await()
            .atMost(Duration.ofSeconds(40))
            .until(
                () -> {
                  try (var check = jdbi.open()) {
                    return check
                            .createQuery(
                                "SELECT count(*) FROM information_schema.processlist WHERE STATE = 'User lock'")
                            .mapTo(Integer.class)
                            .one()
                        > 0;
                  }
                });
      } finally {
        edited.countDown();
        holder
            .createQuery("SELECT RELEASE_LOCK(:gate)")
            .bind("gate", gate)
            .mapTo(Integer.class)
            .one();
      }
      JsonNode result = imported.get(100, TimeUnit.SECONDS);
      assertEquals(3, result.path("relationsAdded").asInt(), result.toString());
      assertTrue(result.path("messages").toString().contains(partner), result.toString());
      JsonNode current = type(partner);
      assertEquals(winner, current.path("inverse").path("name").asText());
      assertEquals("Edited concurrently", current.path("description").asText());
      assertEquals("BLUE", current.path("paletteKey").asText());
      assertTrue(
          type(forward).path("inverse").isMissingNode(),
          "The losing new type must not retain its inverse");
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
    } finally {
      edited.countDown();
      jdbi.setSqlLogger(previous);
      if (imported != null) imported.get(100, TimeUnit.SECONDS);
      try (var cleanup = jdbi.open()) {
        cleanup.execute("DROP TRIGGER IF EXISTS " + gate);
      }
      exchange(
          "DELETE",
          "/v1/glossaries/name/" + glossary + "?recursive=true&hardDelete=true",
          null,
          "application/json",
          200);
      for (String name : List.of(forward, partner, winner)) {
        JsonNode type =
            exchange("GET", "/v1/relationshipTypes/name/" + name, null, "application/json", 200);
        exchange(
            "DELETE",
            "/v1/relationshipTypes/" + type.path("id").asText() + "?hardDelete=true",
            null,
            "application/json",
            200);
      }
    }
  }

  private String claimedReference(JsonNode type) throws Exception {
    return JSON.writeValueAsString(
        JSON.createObjectNode()
            .put("id", type.path("id").asText())
            .put("name", type.path("name").asText())
            .put("fullyQualifiedName", type.path("name").asText())
            .put("type", "relationshipType"));
  }

  private JsonNode type(String name) throws Exception {
    return exchange("GET", "/v1/relationshipTypes/name/" + name, null, "application/json", 200);
  }

  private JsonNode createType(String glossary, String name) throws Exception {
    return exchange(
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
  }

  private JsonNode exchange(String method, String path, String body, String contentType, int status)
      throws IOException, InterruptedException {
    HttpResponse<String> response =
        HTTP.send(
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
    assertEquals(status, response.statusCode(), response.body());
    return response.body().isBlank() ? JSON.createObjectNode() : JSON.readTree(response.body());
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
