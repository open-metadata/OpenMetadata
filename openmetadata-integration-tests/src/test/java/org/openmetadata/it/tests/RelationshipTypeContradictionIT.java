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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateRelationshipType;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.type.RelationshipPaletteKey;
import org.openmetadata.schema.type.RelationshipTypeCategory;
import org.openmetadata.sdk.exceptions.InvalidRequestException;

/**
 * End-to-end REST verification that contradictory {@link RelationshipCharacteristic} combinations
 * are rejected on the create (POST), PUT (upsert by name), and JSON-patch (PATCH) paths.
 *
 * <p>Covers the fix for the bug where {@code ASYMMETRIC + REFLEXIVE} was silently accepted (even
 * though {@code AsymmetricProperty(R)} entails {@code IrreflexiveProperty(R)} in OWL 2 DL). The PUT
 * upsert path is validated by {@code EntityResource.createOrUpdate} (which calls {@code
 * prepareInternal} before {@code createOrUpdate}), and the updater re-validates on characteristic
 * changes as defense-in-depth.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class RelationshipTypeContradictionIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  @BeforeAll
  static void setup() {
    // Force initialization of the admin client the same way other standalone ITs do.
    SdkClients.adminClient();
  }

  /** POST /v1/relationshipTypes with {ASYMMETRIC, REFLEXIVE} must be rejected (core fix). */
  @Test
  void post_rejectsAsymmetricAndReflexive_400(TestNamespace ns) {
    String name = ns.prefix("asymReflexiveRejected");
    CreateRelationshipType request = baseRequest(name).withCharacteristics(asymReflexive());

    InvalidRequestException ex =
        assertThrows(
            InvalidRequestException.class,
            () -> SdkClients.adminClient().relationshipTypes().create(request));
    assertTrue(
        ex.getMessage().contains("ASYMMETRIC") && ex.getMessage().contains("REFLEXIVE"),
        "Error message must name the incompatible pair: " + ex.getMessage());
  }

  /** POST with the consistent entailment pair {ASYMMETRIC, IRREFLEXIVE} must be accepted. */
  @Test
  void post_acceptsAsymmetricWithIrreflexive_201(TestNamespace ns) {
    String name = ns.prefix("asymIrreflexiveAccepted");
    CreateRelationshipType request =
        baseRequest(name)
            .withCharacteristics(
                Set.of(
                    RelationshipCharacteristic.ASYMMETRIC, RelationshipCharacteristic.IRREFLEXIVE));

    RelationshipType created = SdkClients.adminClient().relationshipTypes().create(request);
    try {
      assertNotNull(created.getId());
      assertEquals(
          Set.of(RelationshipCharacteristic.ASYMMETRIC, RelationshipCharacteristic.IRREFLEXIVE),
          created.getCharacteristics());
    } finally {
      SdkClients.adminClient().relationshipTypes().delete(created.getId().toString(), true);
    }
  }

  /**
   * PUT /v1/relationshipTypes (upsert by name) that CHANGES characteristics to {ASYMMETRIC,
   * REFLEXIVE} on an EXISTING entity must be rejected. The PUT upsert route validates through
   * {@code EntityResource.createOrUpdate} → {@code prepareInternal}; the updater also re-validates
   * on characteristic changes as defense-in-depth.
   */
  @Test
  void put_rejectsContradictoryAsymmetricAndReflexive_400(TestNamespace ns) {
    RelationshipType created = createTransitive(ns, "putRejectAsymReflex");
    try {
      CreateRelationshipType upsertRequest =
          baseRequest(created.getName()).withCharacteristics(asymReflexive());
      InvalidRequestException ex =
          assertThrows(
              InvalidRequestException.class,
              () -> SdkClients.adminClient().relationshipTypes().upsert(upsertRequest));
      assertTrue(
          ex.getMessage().contains("ASYMMETRIC") && ex.getMessage().contains("REFLEXIVE"),
          "PUT error must name the incompatible pair: " + ex.getMessage());
    } finally {
      SdkClients.adminClient().relationshipTypes().delete(created.getId().toString(), true);
    }
  }

  /**
   * PUT (upsert by name) that changes characteristics to a valid pair ({REFLEXIVE}) must succeed.
   * Also exercises the updater's characteristics-change revalidation on the success path.
   */
  @Test
  void put_acceptsValidCharacteristicChange_200(TestNamespace ns) {
    RelationshipType created = createTransitive(ns, "putAcceptReflex");
    try {
      CreateRelationshipType upsertRequest =
          baseRequest(created.getName())
              .withCharacteristics(Set.of(RelationshipCharacteristic.REFLEXIVE));
      RelationshipType updated = SdkClients.adminClient().relationshipTypes().upsert(upsertRequest);
      assertEquals(Set.of(RelationshipCharacteristic.REFLEXIVE), updated.getCharacteristics());

      // Verify it persisted.
      RelationshipType fetched =
          SdkClients.adminClient().relationshipTypes().get(created.getId().toString());
      assertEquals(Set.of(RelationshipCharacteristic.REFLEXIVE), fetched.getCharacteristics());
    } finally {
      SdkClients.adminClient().relationshipTypes().delete(created.getId().toString(), true);
    }
  }

  /**
   * JSON-patch (PATCH /v1/relationshipTypes/{id}) replacing /characteristics with the
   * contradictory pair must be rejected.
   */
  @Test
  void patch_rejectsContradictoryAsymmetricAndReflexive_400(TestNamespace ns) throws Exception {
    RelationshipType created = createTransitive(ns, "patchRejectAsymReflex");
    try {
      String patch =
          "[{\"op\":\"replace\",\"path\":\"/characteristics\",\"value\":[\"ASYMMETRIC\",\"REFLEXIVE\"]}]";
      JsonNode patchDocument = OBJECT_MAPPER.readTree(patch);
      InvalidRequestException ex =
          assertThrows(
              InvalidRequestException.class,
              () ->
                  SdkClients.adminClient()
                      .relationshipTypes()
                      .patch(created.getId().toString(), patchDocument));
      assertTrue(
          ex.getMessage().contains("ASYMMETRIC") && ex.getMessage().contains("REFLEXIVE"),
          "PATCH error must name the incompatible pair: " + ex.getMessage());
    } finally {
      SdkClients.adminClient().relationshipTypes().delete(created.getId().toString(), true);
    }
  }

  private RelationshipType createTransitive(TestNamespace ns, String suffix) {
    String name = ns.prefix(suffix);
    CreateRelationshipType request =
        baseRequest(name).withCharacteristics(Set.of(RelationshipCharacteristic.TRANSITIVE));
    return SdkClients.adminClient().relationshipTypes().create(request);
  }

  private static Set<RelationshipCharacteristic> asymReflexive() {
    return Set.of(RelationshipCharacteristic.ASYMMETRIC, RelationshipCharacteristic.REFLEXIVE);
  }

  private static CreateRelationshipType baseRequest(String name) {
    URI predicateIri =
        URI.create(
            "https://example.org/ontology/"
                + UUID.nameUUIDFromBytes(name.getBytes(StandardCharsets.UTF_8)));
    return new CreateRelationshipType()
        .withName(name)
        .withDisplayName(name)
        .withDescription("Governed ontology relationship " + name)
        .withIri(predicateIri)
        .withRdfPredicate(predicateIri)
        .withCategory(RelationshipTypeCategory.CUSTOM)
        .withCrossGlossaryAllowed(true)
        .withPaletteKey(RelationshipPaletteKey.VIOLET);
  }
}
