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

package org.openmetadata.sdk.services.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonPatch;
import jakarta.json.JsonReader;
import java.io.StringReader;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.type.OntologyPackInstallation;
import org.openmetadata.schema.type.OntologyPublicationStatus;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Regression coverage for {@link OntologyService#normalizePatchNodes}, which strips the
 * server-recorded, PATCH-immutable fields ({@code installedPacks} and {@code publicationStatus})
 * from the diff computed by {@link org.openmetadata.sdk.services.EntityServiceBase#update}.
 *
 * <p>The server rejects any patch that mutates {@code installedPacks} (see {@code
 * OntologyRepository.validatePatch}: "installedPacks is recorded by the server when a library pack
 * installs"). The generated {@link Ontology} class initializes {@code installedPacks =
 * new ArrayList<>()}, so a programmatic {@code new Ontology()} serializes as {@code
 * "installedPacks": []}. Without normalization the SDK's diff would emit a {@code remove} op
 * against any server baseline with installed packs, turning every {@code ontologies().update(id,
 * entity)} call that touches unrelated fields into an HTTP 400.
 */
class OntologyServiceUpdateMockTest {
  private static final String BASE_PATH = "/v1/ontologies";
  private static final UUID ONTOLOGY_ID = UUID.fromString("10000000-0000-0000-0000-000000000001");

  private HttpClient httpClient;
  private OntologyService service;

  @BeforeEach
  void setUp() {
    httpClient = mock(HttpClient.class);
    service = new OntologyService(httpClient);
  }

  /**
   * Primary regression: the snapshot-path caller pattern -- {@code get(id)} then {@code
   * update(id, edited)} -- when the server has installed library packs. Before the fix the
   * default empty {@code installedPacks} on the constructed {@link Ontology} surfaced as a
   * {@code remove /installedPacks/0} op and the server rejected the call with HTTP 400.
   */
  @Test
  void updateWithSnapshotBaselineStripsInstalledPacksFromPatch() throws Exception {
    final Ontology stored = storedOntologyWithInstalledPacks();
    stubGet(stored);
    service.get(ONTOLOGY_ID.toString()); // populate snapshot

    final Ontology updated = minimalUpdate(stored, "New description after update");

    final JsonNode patch = capturePatchAndInvokeUpdate(updated);

    assertNoOpTouches(patch, "installedPacks");
    assertNoOpTouches(patch, "publicationStatus");
    assertDescriptionReplacePresent(patch);
    assertServerWouldAcceptPatch(patch, stored);
  }

  /**
   * Re-fetch fallback path: the snapshot cache misses (LRU eviction, or the client never called
   * {@code get()}) and {@code update()} re-fetches the stored ontology to compute the diff. The
   * fix must apply on this path too because the fetched baseline still carries the server's
   * {@code installedPacks}.
   */
  @Test
  void updateWithRefetchedBaselineStripsInstalledPacksFromPatch() throws Exception {
    final Ontology stored = storedOntologyWithInstalledPacks();
    // No prior service.get(...): snapshot cache is empty, so update() re-fetches via
    // EntityServiceBase.fetchEntity(...), which uses the 5-arg overload with RequestOptions.
    stubGet(stored);
    when(httpClient.execute(
            eq(HttpMethod.GET),
            eq(BASE_PATH + "/" + ONTOLOGY_ID),
            isNull(),
            eq(Ontology.class),
            any()))
        .thenReturn(stored);

    final Ontology updated = minimalUpdate(stored, "Updated after refetch");

    final JsonNode patch = capturePatchAndInvokeUpdate(updated);

    assertNoOpTouches(patch, "installedPacks");
    assertDescriptionReplacePresent(patch);
    assertServerWouldAcceptPatch(patch, stored);
  }

  /**
   * Pins the sibling server-derived field {@code publicationStatus} handling -- also stripped by
   * {@code normalizePatchNodes}. The {@code installedPacks} fix must not perturb the existing
   * {@code publicationStatus} strip, and the strip must survive a caller that sets the field
   * explicitly.
   */
  @Test
  void updateStripsPublicationStatusFromPatch() throws Exception {
    final Ontology stored = storedOntologyWithInstalledPacks();
    stubGet(stored);
    service.get(ONTOLOGY_ID.toString());

    final Ontology updated = minimalUpdate(stored, "Updated publicationStatus regression");
    updated.setPublicationStatus(new OntologyPublicationStatus().withUnpublishedChanges(0));

    final JsonNode patch = capturePatchAndInvokeUpdate(updated);

    assertNoOpTouches(patch, "publicationStatus");
    assertDescriptionReplacePresent(patch);
  }

  /**
   * Even when the caller's {@code Ontology} carries the exact same {@code installedPacks} (the
   * round-trip-stable path used by {@code BaseOntologyIT.nativeDefinitionIriSurvivesUpdatesAndRestoration}),
   * the patch must remain clean of any {@code installedPacks} op -- stripping is unconditional, not
   * equality-gated, so behavior is identical whether or not the caller reproduces the server value.
   */
  @Test
  void updateStripsInstalledPacksEvenWhenCallerCopiesServerValue() throws Exception {
    final Ontology stored = storedOntologyWithInstalledPacks();
    stubGet(stored);
    service.get(ONTOLOGY_ID.toString());

    final Ontology updated = minimalUpdate(stored, "Updated keeping installedPacks");
    updated.setInstalledPacks(List.copyOf(stored.getInstalledPacks()));

    final JsonNode patch = capturePatchAndInvokeUpdate(updated);

    assertNoOpTouches(patch, "installedPacks");
    assertDescriptionReplacePresent(patch);
    assertServerWouldAcceptPatch(patch, stored);
  }

  // ---------- helpers ----------

  private void stubGet(Ontology stored) {
    when(httpClient.execute(
            eq(HttpMethod.GET), eq(BASE_PATH + "/" + ONTOLOGY_ID), isNull(), eq(Ontology.class)))
        .thenReturn(stored);
  }

  private JsonNode capturePatchAndInvokeUpdate(Ontology updated) {
    ArgumentCaptor<JsonNode> patch = ArgumentCaptor.forClass(JsonNode.class);
    when(httpClient.execute(
            eq(HttpMethod.PATCH),
            eq(BASE_PATH + "/" + ONTOLOGY_ID),
            patch.capture(),
            eq(Ontology.class),
            isNull()))
        .thenReturn(updated);
    service.update(ONTOLOGY_ID.toString(), updated);
    final JsonNode captured = patch.getValue();
    assertNotNull(captured, "PATCH request body must be sent");
    assertTrue(captured.isArray(), "patch must be a JSON array, got: " + captured);
    return captured;
  }

  private static Ontology minimalUpdate(Ontology stored, String description) {
    return new Ontology()
        .withId(ONTOLOGY_ID)
        .withName(stored.getName())
        .withFullyQualifiedName(stored.getFullyQualifiedName())
        .withDescription(description);
  }

  private static Ontology storedOntologyWithInstalledPacks() {
    return new Ontology()
        .withId(ONTOLOGY_ID)
        .withName("FhirOntology")
        .withFullyQualifiedName("ns.FhirOntology")
        .withDescription("Original description")
        .withInstalledPacks(
            List.of(new OntologyPackInstallation().withPackId("fhir").withVersion("1.0.0")))
        .withPublicationStatus(new OntologyPublicationStatus().withUnpublishedChanges(1));
  }

  /**
   * Asserts no operation in {@code patch} targets {@code fieldName} or any path nested under it.
   * This is the cardinal guarantee for a server-recorded, PATCH-immutable field: the only way to
   * guarantee the server's equality check passes is to omit the field from the diff entirely.
   */
  private static void assertNoOpTouches(JsonNode patch, String fieldName) {
    for (JsonNode op : patch) {
      final String path = op.path("path").asText("");
      assertFalse(
          path.equals("/" + fieldName) || path.startsWith("/" + fieldName + "/"),
          "patch must not touch " + fieldName + ", but found op: " + op);
    }
  }

  private static void assertDescriptionReplacePresent(JsonNode patch) {
    boolean found = false;
    for (JsonNode op : patch) {
      if ("replace".equals(op.path("op").asText(""))
          && "/description".equals(op.path("path").asText(""))) {
        found = true;
        break;
      }
    }
    assertTrue(found, "patch must still emit the legitimate description change: " + patch);
  }

  /**
   * Replicates the server-side flow in {@code OntologyRepository.validatePatch}: apply the captured
   * patch to the stored baseline and assert the resulting {@code installedPacks} matches the
   * original. The server compares the lists with {@link java.util.Objects#equals} and rejects the
   * request with HTTP 400 when they differ.
   *
   * <p>The patch is applied with the {@code jakarta.json.JsonPatch} implementation (parsson), the
   * same provider the SDK's tests already use (see {@code EntityServiceBaseTest#applyPatch}) and a
   * plain Jackson {@link ObjectMapper} mirrors {@code JsonUtils.OBJECT_MAPPER} for the entity
   * serialization. We avoid {@code JsonUtils} itself here because its static initializer also
   * registers the legacy {@code javax.json} {@code JSR353Module}, whose provider is not on the
   * SDK's test classpath.
   */
  private static void assertServerWouldAcceptPatch(JsonNode patch, Ontology stored)
      throws Exception {
    final ObjectMapper serverMapper = new ObjectMapper();
    final JsonNode patched = applyPatch(patch, serverMapper.valueToTree(stored));
    final Ontology patchedOntology = serverMapper.treeToValue(patched, Ontology.class);
    assertEquals(
        stored.getInstalledPacks(),
        patchedOntology.getInstalledPacks(),
        () ->
            "OntologyRepository.validatePatch would reject this patch with HTTP 400 "
                + "because installedPacks is mutated: original="
                + stored.getInstalledPacks()
                + " patched="
                + patchedOntology.getInstalledPacks());
  }

  private static JsonNode applyPatch(JsonNode patch, JsonNode document)
      throws JsonProcessingException {
    final JsonPatch jsonPatch;
    try (JsonReader patchReader = Json.createReader(new StringReader(patch.toString()))) {
      jsonPatch = Json.createPatch(patchReader.readArray());
    }
    final JsonObject documentJson;
    try (JsonReader documentReader = Json.createReader(new StringReader(document.toString()))) {
      documentJson = documentReader.readObject();
    }
    return new ObjectMapper().readTree(jsonPatch.apply(documentJson).toString());
  }
}
