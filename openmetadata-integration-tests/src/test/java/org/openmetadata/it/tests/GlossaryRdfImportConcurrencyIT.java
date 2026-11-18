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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import jakarta.ws.rs.BadRequestException;
import java.io.IOException;
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
import java.util.concurrent.atomic.AtomicReference;
import org.jdbi.v3.core.Jdbi;
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
import org.openmetadata.service.Entity;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.ontology.RelationshipTypeIds;

/**
 * Races a REST edit of an existing inverse partner against an RDF import that completes it. Each
 * test pauses the import at one registry statement and runs the competing request there, so each
 * of the importer's claim checks has a test that fails without it.
 */
@Isolated("Temporarily replaces the global SQL logger to gate registry statements")
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class GlossaryRdfImportConcurrencyIT {
  private static final ObjectMapper JSON = new ObjectMapper();
  private static final HttpClient HTTP = HttpClient.newHttpClient();
  private static final String JSON_TYPE = "application/json";
  private static final String PATCH_TYPE = "application/json-patch+json";
  private static final String ORIGINAL = "Original description";
  private static final String EDITED = "Edited concurrently";
  private static final String CHANGED_BEFORE = "changed before completion";
  private final Set<UUID> typeIds = new LinkedHashSet<>();

  enum Boundary {
    AFTER_DISCOVERY,
    AFTER_INSERT,
    BEFORE_PARTNER_WRITE
  }

  enum Competitor {
    CLAIM_FOR_OTHER,
    CLAIM_FOR_FORWARD,
    EDIT_DESCRIPTION,
    FAIL_VALIDATION
  }

  record Fixture(String glossary, String forward, JsonNode partner, JsonNode winner) {
    String partnerName() {
      return partner.path("name").asText();
    }

    String winnerName() {
      return winner.path("name").asText();
    }
  }

  @Test
  void claimAfterDiscoveryIsRejectedBeforeInsertion(TestNamespace ns) throws Exception {
    Fixture fixture = createFixture(ns);
    JsonNode result =
        importWithCompetitor(fixture, Boundary.AFTER_DISCOVERY, Competitor.CLAIM_FOR_OTHER);
    assertLostToOtherClaim(fixture, result, 0.1);
  }

  @Test
  void claimAfterInsertionClearsThePersistedInverse(TestNamespace ns) throws Exception {
    Fixture fixture = createFixture(ns);
    JsonNode result =
        importWithCompetitor(fixture, Boundary.AFTER_INSERT, Competitor.CLAIM_FOR_OTHER);
    assertLostToOtherClaim(fixture, result, 0.2);
  }

  @Test
  void claimBeforePartnerWriteIsNotOverwritten(TestNamespace ns) throws Exception {
    Fixture fixture = createFixture(ns);
    JsonNode result =
        importWithCompetitor(fixture, Boundary.BEFORE_PARTNER_WRITE, Competitor.CLAIM_FOR_OTHER);
    assertLostToOtherClaim(fixture, result, 0.2);
  }

  @Test
  void sameClaimBeforePartnerWriteKeepsTheNewInverse(TestNamespace ns) throws Exception {
    Fixture fixture = createFixture(ns);
    JsonNode result =
        importWithCompetitor(fixture, Boundary.BEFORE_PARTNER_WRITE, Competitor.CLAIM_FOR_FORWARD);
    assertCompletedPair(fixture, result);
  }

  @Test
  void unrelatedEditBeforePartnerWriteStillCompletesThePair(TestNamespace ns) throws Exception {
    Fixture fixture = createFixture(ns);
    JsonNode result =
        importWithCompetitor(fixture, Boundary.BEFORE_PARTNER_WRITE, Competitor.EDIT_DESCRIPTION);
    assertCompletedPair(fixture, result);
  }

  @Test
  void partnerValidationFailureClearsTheNewInverse(TestNamespace ns) throws Exception {
    Fixture fixture = createFixture(ns);
    JsonNode result =
        importWithCompetitor(fixture, Boundary.BEFORE_PARTNER_WRITE, Competitor.FAIL_VALIDATION);
    JsonNode partner = type(fixture.partnerName());
    assertTrue(partner.path("inverse").isMissingNode(), partner.toString());
    assertEquals(ORIGINAL, partner.path("description").asText());
    assertForwardLost(fixture, result, "could not be completed", 0.2);
  }

  private Fixture createFixture(TestNamespace ns) throws IOException, InterruptedException {
    String glossary = GlossaryTestFactory.createSimple(ns).getName();
    String forward = typeName(ns, "forward");
    typeIds.add(RelationshipTypeIds.stableId(forward));
    JsonNode partner = createType(glossary, typeName(ns, "partner"));
    JsonNode winner = createType(glossary, typeName(ns, "winner"));
    return new Fixture(glossary, forward, partner, winner);
  }

  private JsonNode importWithCompetitor(Fixture fixture, Boundary boundary, Competitor competitor)
      throws IOException, InterruptedException {
    AtomicReference<Throwable> failure = new AtomicReference<>();
    Runnable competingRequest = competingRequest(fixture, competitor, failure);
    JsonNode result;
    boolean fired;
    try (StatementGate gate = new StatementGate(fixture, boundary, competingRequest)) {
      result = exchange("PUT", importPath(fixture), ontology(fixture), "text/turtle", 200);
      fired = gate.fired();
    } catch (AssertionError importFailure) {
      if (failure.get() != null) {
        importFailure.addSuppressed(failure.get());
      }
      throw importFailure;
    }
    assertNull(failure.get(), () -> "The competing request failed: " + failure.get());
    assertTrue(fired, "The gated registry statement must be reached: " + boundary);
    return result;
  }

  private Runnable competingRequest(
      Fixture fixture, Competitor competitor, AtomicReference<Throwable> failure) {
    UUID forwardId = RelationshipTypeIds.stableId(fixture.forward());
    UUID winnerId = UUID.fromString(fixture.winner().path("id").asText());
    return switch (competitor) {
      case CLAIM_FOR_OTHER -> () ->
          patchPartner(fixture, claimPatch(winnerId, fixture.winnerName()), failure);
      case CLAIM_FOR_FORWARD -> () ->
          patchPartner(fixture, claimPatch(forwardId, fixture.forward()), failure);
      case EDIT_DESCRIPTION -> () -> patchPartner(fixture, descriptionPatch().toString(), failure);
      case FAIL_VALIDATION -> () -> {
        throw new BadRequestException("Injected partner validation failure");
      };
    };
  }

  private void patchPartner(Fixture fixture, String patch, AtomicReference<Throwable> failure) {
    try {
      String path = "/v1/relationshipTypes/" + fixture.partner().path("id").asText();
      JsonNode edited = exchange("PATCH", path, patch, PATCH_TYPE, 200);
      double before = fixture.partner().path("version").asDouble();
      assertTrue(edited.path("version").asDouble() > before, "The edit must advance the version");
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      failure.set(exception);
    } catch (IOException | AssertionError exception) {
      failure.set(exception);
    }
  }

  private void assertLostToOtherClaim(Fixture fixture, JsonNode result, double forwardVersion)
      throws IOException, InterruptedException {
    JsonNode partner = type(fixture.partnerName());
    assertEquals(fixture.winnerName(), partner.path("inverse").path("name").asText());
    assertEquals(EDITED, partner.path("description").asText());
    assertEquals("BLUE", partner.path("paletteKey").asText());
    assertForwardLost(fixture, result, CHANGED_BEFORE, forwardVersion);
  }

  private void assertForwardLost(Fixture fixture, JsonNode result, String message, double version)
      throws IOException, InterruptedException {
    String messages = result.path("messages").toString();
    assertTrue(messages.contains(fixture.partnerName()), result.toString());
    assertTrue(messages.contains(message), result.toString());
    JsonNode forward = type(fixture.forward());
    assertTrue(
        forward.path("inverse").isMissingNode(), "The losing type must not keep its inverse");
    assertEquals(version, forward.path("version").asDouble());
    assertEdges(fixture, result, fixture.forward());
  }

  private void assertCompletedPair(Fixture fixture, JsonNode result)
      throws IOException, InterruptedException {
    assertTrue(result.path("messages").isEmpty(), result.toString());
    JsonNode partner = type(fixture.partnerName());
    assertEquals(fixture.forward(), partner.path("inverse").path("name").asText());
    assertEquals(EDITED, partner.path("description").asText());
    JsonNode forward = type(fixture.forward());
    assertEquals(fixture.partnerName(), forward.path("inverse").path("name").asText());
    assertEquals(0.1, forward.path("version").asDouble());
    assertEdges(fixture, result, fixture.partnerName());
  }

  private void assertEdges(Fixture fixture, JsonNode result, String incomingType)
      throws IOException, InterruptedException {
    assertEquals(3, result.path("relationsAdded").asInt(), result.toString());
    for (int index = 0; index < 3; index++) {
      String path =
          "/v1/glossaryTerms/name/" + fixture.glossary() + ".T" + index + "?fields=relatedTerms";
      JsonNode term = exchange("GET", path, null, JSON_TYPE, 200);
      List<String> edges = new ArrayList<>();
      for (JsonNode relation : term.path("relatedTerms")) {
        edges.add(
            relation.path("relationType").asText()
                + ">"
                + relation.path("term").path("name").asText());
      }
      String next = fixture.forward() + ">T" + ((index + 1) % 3);
      String previous = incomingType + ">T" + ((index + 2) % 3);
      assertEquals(Set.of(next, previous), Set.copyOf(edges), term.toString());
    }
  }

  @AfterEach
  void cleanup(TestNamespace ns) throws Exception {
    try {
      NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
    } finally {
      List<String> failures = new ArrayList<>();
      for (UUID id : typeIds) {
        clearInverse(id, failures);
      }
      for (UUID id : typeIds) {
        HttpResponse<String> response =
            request("DELETE", "/v1/relationshipTypes/" + id + "?hardDelete=true", null, JSON_TYPE);
        if (response.statusCode() != 200 && response.statusCode() != 404) {
          failures.add(response.body());
        }
      }
      assertTrue(failures.isEmpty(), failures.toString());
    }
  }

  private void clearInverse(UUID id, List<String> failures)
      throws IOException, InterruptedException {
    HttpResponse<String> current = request("GET", "/v1/relationshipTypes/" + id, null, JSON_TYPE);
    if (current.statusCode() == 200 && JSON.readTree(current.body()).hasNonNull("inverse")) {
      String remove = "[{\"op\":\"remove\",\"path\":\"/inverse\"}]";
      HttpResponse<String> cleared =
          request("PATCH", "/v1/relationshipTypes/" + id, remove, PATCH_TYPE);
      if (cleared.statusCode() != 200) {
        failures.add(cleared.body());
      }
    }
  }

  private static ArrayNode descriptionPatch() {
    ArrayNode patch = JSON.createArrayNode();
    patch.addObject().put("op", "replace").put("path", "/description").put("value", EDITED);
    return patch;
  }

  private static String claimPatch(UUID id, String name) {
    ArrayNode patch = descriptionPatch();
    patch.addObject().put("op", "replace").put("path", "/paletteKey").put("value", "BLUE");
    patch
        .addObject()
        .put("op", "add")
        .put("path", "/inverse")
        .putObject("value")
        .put("id", id.toString())
        .put("name", name)
        .put("fullyQualifiedName", name)
        .put("type", "relationshipType");
    return patch.toString();
  }

  private static String typeName(TestNamespace ns, String role) {
    return ns.shortPrefix(role).replaceAll("[^a-zA-Z0-9]", "");
  }

  private static String importPath(Fixture fixture) {
    return "/v1/glossaries/name/" + fixture.glossary() + "/importRdf?dryRun=false&format=turtle";
  }

  private JsonNode type(String name) throws IOException, InterruptedException {
    return exchange("GET", "/v1/relationshipTypes/name/" + name, null, JSON_TYPE, 200);
  }

  private JsonNode createType(String glossary, String name)
      throws IOException, InterruptedException {
    String body =
        JSON.createObjectNode()
            .put("name", name)
            .put("displayName", name)
            .put("description", ORIGINAL)
            .put("rdfPredicate", "http://example.org/" + glossary + "#" + name)
            .put("category", "CUSTOM")
            .put("paletteKey", "VIOLET")
            .toString();
    JsonNode result = exchange("POST", "/v1/relationshipTypes", body, JSON_TYPE, 201);
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
    HttpRequest.BodyPublisher publisher =
        body == null
            ? HttpRequest.BodyPublishers.noBody()
            : HttpRequest.BodyPublishers.ofString(body);
    return HTTP.send(
        HttpRequest.newBuilder(URI.create(SdkClients.getServerUrl() + path))
            .timeout(Duration.ofSeconds(100))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", contentType)
            .method(method, publisher)
            .build(),
        HttpResponse.BodyHandlers.ofString());
  }

  private static String ontology(Fixture fixture) {
    return """
        @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix p: <http://example.org/%1$s#> .
        p:T0 a skos:Concept ; p:%2$s p:T1 .
        p:T1 a skos:Concept ; p:%2$s p:T2 .
        p:T2 a skos:Concept ; p:%2$s p:T0 .
        p:%2$s a owl:ObjectProperty ; owl:inverseOf p:%3$s .
        """
        .formatted(fixture.glossary(), fixture.forward(), fixture.partnerName());
  }

  /** Runs the competing request once, when the import reaches the requested registry statement. */
  private static final class StatementGate implements SqlLogger, AutoCloseable {
    private final Jdbi jdbi = Entity.getJdbi();
    private final SqlLogger delegate = jdbi.getConfig(SqlStatements.class).getSqlLogger();
    private final Fixture fixture;
    private final Boundary boundary;
    private final Runnable competingRequest;
    private final AtomicBoolean inserted = new AtomicBoolean();
    private final AtomicBoolean fired = new AtomicBoolean();

    StatementGate(Fixture fixture, Boundary boundary, Runnable competingRequest) {
      this.fixture = fixture;
      this.boundary = boundary;
      this.competingRequest = competingRequest;
      jdbi.setSqlLogger(this);
    }

    boolean fired() {
      return fired.get();
    }

    @Override
    public void logBeforeExecution(StatementContext context) {
      delegate.logBeforeExecution(context);
    }

    @Override
    public void logException(StatementContext context, SQLException exception) {
      delegate.logException(context, exception);
    }

    @Override
    public void logAfterExecution(StatementContext context) {
      delegate.logAfterExecution(context);
      if (isImportStatement() && reachedBoundary(context) && fired.compareAndSet(false, true)) {
        competingRequest.run();
      }
    }

    private boolean isImportStatement() {
      var request = RequestLatencyContext.getContext();
      return request != null
          && request.getUriPath() != null
          && request.getUriPath().contains(fixture.glossary());
    }

    private boolean reachedBoundary(StatementContext context) {
      String sql = context.getRenderedSql().toLowerCase(Locale.ROOT);
      boolean typeInsert = sql.contains("insert into relationship_type_entity");
      if (typeInsert) {
        inserted.set(true);
      }
      boolean partnerRead =
          sql.contains("relationship_type_entity")
              && sql.contains("rdfpredicate")
              && context.getBinding().toString().contains("#" + fixture.partnerName());
      return switch (boundary) {
        case AFTER_DISCOVERY -> partnerRead && !inserted.get();
        case AFTER_INSERT -> typeInsert;
        case BEFORE_PARTNER_WRITE -> partnerRead && inserted.get();
      };
    }

    @Override
    public void close() {
      jdbi.setSqlLogger(delegate);
    }
  }
}
