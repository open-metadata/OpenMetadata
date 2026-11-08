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

package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationType;

class OntologyPackSlicePlanTest {
  private static final String PACK_DIGEST = "ab".repeat(32);

  @Test
  void ordersConceptsThenPropertiesThenAxiomsAndCutsAtTheSliceSize() {
    final List<OntologyChangeOperation> shuffled =
        List.of(
            axiom("a1"),
            property("p1"),
            concept("c1"),
            axiom("a2"),
            concept("c2"),
            property("p2"),
            concept("c3"));

    final OntologyPackSlicePlan plan = OntologyPackSlicePlan.of(shuffled, 3, PACK_DIGEST);

    assertEquals(
        List.of(List.of("c1", "c2", "c3"), List.of("p1", "p2", "a1"), List.of("a2")),
        plan.slices().stream()
            .map(slice -> slice.operations().stream().map(OntologyPackSlicePlanTest::name).toList())
            .toList());
    assertEquals(List.of(0, 1, 2), plan.slices().stream().map(slice -> slice.index()).toList());
    assertEquals(7, plan.memberCount());
  }

  @Test
  void holdsAtMostTheSliceSizePerSlice() {
    assertEquals(List.of(1000), sizesOf(1000, 1000));
    assertEquals(List.of(1000, 1), sizesOf(1001, 1000));
    assertEquals(List.of(1000, 1000, 500), sizesOf(2500, 1000));
    assertEquals(List.of(), sizesOf(0, 1000));
  }

  @Test
  void anEmptyPlanHasNoSlicesAndAStableDigest() {
    final OntologyPackSlicePlan plan = OntologyPackSlicePlan.of(List.of(), 1000, PACK_DIGEST);

    assertEquals(List.of(), plan.slices());
    assertEquals(
        "82a6564112bc37029d3b015453401525faa10b0729c2f72d3032a5f4c13bad51", plan.planDigest());
  }

  @Test
  void sliceDigestIgnoresGeneratedIdsAndOperationOrderButNotPayload() {
    final List<OntologyChangeOperation> first = List.of(concept("c1"), concept("c2"));
    final List<OntologyChangeOperation> reordered =
        new ArrayList<>(List.of(concept("c1"), concept("c2")));
    Collections.reverse(reordered);
    final List<OntologyChangeOperation> changed = List.of(concept("c1"), concept("c3"));

    assertEquals(
        OntologyPackSlicePlan.sliceDigest(first), OntologyPackSlicePlan.sliceDigest(reordered));
    assertNotEquals(
        OntologyPackSlicePlan.sliceDigest(first), OntologyPackSlicePlan.sliceDigest(changed));
  }

  @Test
  void digestsMatchTheirReferenceValues() {
    final OntologyPackSlicePlan plan =
        OntologyPackSlicePlan.of(
            List.of(concept("c1"), concept("c2"), property("p1")), 2, PACK_DIGEST);

    assertEquals(
        List.of(
            "dcaeb5e00e83f93588c5a39ec85d42aba2145d80c1f084411a5b7191ce55fdfc",
            "cc246c47dbd1ed89b138ded4010798d649d1e7a5193be07fbc7840a95dec86bc"),
        plan.sliceDigests());
    assertEquals(
        "a3640b4f14faf87dbf39ac4dbdb874f323d261ee4b62f4f61fcf0c1cce110851", plan.planDigest());
  }

  @Test
  void aPlanDigestBindsThePackContentAndTheSliceOrder() {
    final List<String> digests = List.of("1".repeat(64), "2".repeat(64));

    assertNotEquals(
        OntologyPackSlicePlan.planDigest(PACK_DIGEST, digests),
        OntologyPackSlicePlan.planDigest("cd".repeat(32), digests));
    assertNotEquals(
        OntologyPackSlicePlan.planDigest(PACK_DIGEST, digests),
        OntologyPackSlicePlan.planDigest(PACK_DIGEST, digests.reversed()));
  }

  @Test
  void refusesDeletesAndEmptySlices() {
    final OntologyChangeOperation delete =
        new OntologyChangeOperation()
            .withId(UUID.randomUUID())
            .withOperationType(OntologyChangeOperationType.DELETE_CONCEPT);

    assertThrows(
        IllegalArgumentException.class,
        () -> OntologyPackSlicePlan.of(List.of(delete), 10, PACK_DIGEST));
    assertThrows(
        IllegalArgumentException.class,
        () -> OntologyPackSlicePlan.of(List.of(concept("c1")), 0, PACK_DIGEST));
  }

  @Test
  void aDefinitionFollowsTheDefinitionsItNamesAndAPairStaysInOneSlice() {
    final List<OntologyChangeOperation> input =
        List.of(
            property("a", null, "d"),
            property("b", "c", null),
            property("c", "b", null),
            property("d", null, null));

    final OntologyPackSlicePlan plan = OntologyPackSlicePlan.of(input, 2, PACK_DIGEST);

    assertEquals(List.of(List.of("b", "c"), List.of("d", "a")), names(plan));
  }

  @Test
  void aChainOfReplacementsAppliesFromTheEndBackward() {
    final List<OntologyChangeOperation> input =
        List.of(concept("x", "y"), concept("y", "z"), concept("z", null), concept("w", null));

    final OntologyPackSlicePlan plan = OntologyPackSlicePlan.of(input, 1, PACK_DIGEST);

    assertEquals(List.of(List.of("w"), List.of("z"), List.of("y"), List.of("x")), names(plan));
  }

  @Test
  void aReferenceToADefinitionOutsideThePlanDoesNotOrderAnything() {
    final List<OntologyChangeOperation> input = List.of(concept("b", "stored"), concept("a", null));

    assertEquals(
        List.of(List.of("a"), List.of("b")),
        names(OntologyPackSlicePlan.of(input, 1, PACK_DIGEST)));
  }

  @Test
  void aUnitThatDoesNotFitTheRestOfASliceStartsTheNextOne() {
    final List<OntologyChangeOperation> input =
        List.of(
            property("a", null, null),
            property("b", "c", null),
            property("c", "d", null),
            property("d", "b", null));

    assertEquals(
        List.of(List.of("a"), List.of("b", "c", "d")),
        names(OntologyPackSlicePlan.of(input, 3, PACK_DIGEST)));
  }

  @Test
  void aCycleLargerThanASliceIsRefusedBeforeAnythingIsApplied() {
    final List<OntologyChangeOperation> input =
        List.of(property("b", "c", null), property("c", "b", null));

    assertThrows(
        IllegalStateException.class, () -> OntologyPackSlicePlan.of(input, 1, PACK_DIGEST));
  }

  @Test
  void theSamePlanComesOutWhateverOrderTheOperationsArriveIn() {
    final List<OntologyChangeOperation> input =
        List.of(
            property("a", null, "d"),
            property("b", "c", null),
            property("c", "b", null),
            property("d", null, null),
            concept("x", "y"),
            concept("y", null));
    final List<OntologyChangeOperation> reversed = new ArrayList<>(input);
    Collections.reverse(reversed);

    final OntologyPackSlicePlan plan = OntologyPackSlicePlan.of(input, 2, PACK_DIGEST);

    assertEquals(List.of(List.of("y", "x"), List.of("b", "c"), List.of("d", "a")), names(plan));
    assertEquals(
        plan.planDigest(), OntologyPackSlicePlan.of(reversed, 2, PACK_DIGEST).planDigest());
  }

  @Test
  void aLongChainOfReferencesDoesNotOverflowTheStack() {
    final List<OntologyChangeOperation> chain =
        IntStream.range(0, 20_000)
            .mapToObj(i -> concept("c%05d".formatted(i), "c%05d".formatted(i + 1)))
            .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
    Collections.reverse(chain);

    final OntologyPackSlicePlan plan = OntologyPackSlicePlan.of(chain, 1000, PACK_DIGEST);

    assertEquals("c19999", name(plan.slices().getFirst().operations().getFirst()));
    assertEquals("c00000", name(plan.slices().getLast().operations().getLast()));
    assertEquals(20, plan.slices().size());
  }

  private static List<List<String>> names(final OntologyPackSlicePlan plan) {
    return plan.slices().stream()
        .map(slice -> slice.operations().stream().map(OntologyPackSlicePlanTest::name).toList())
        .toList();
  }

  private static List<Integer> sizesOf(final int members, final int sliceMembers) {
    final List<OntologyChangeOperation> operations =
        IntStream.range(0, members).mapToObj(index -> concept("c" + index)).toList();
    return OntologyPackSlicePlan.of(operations, sliceMembers, PACK_DIGEST).slices().stream()
        .map(slice -> slice.operations().size())
        .toList();
  }

  private static String name(final OntologyChangeOperation operation) {
    return switch (operation.getOperationType()) {
      case UPSERT_CONCEPT -> operation.getConcept().getName();
      case UPSERT_PROPERTY -> operation.getProperty().getName();
      default -> operation.getAxiom().getName();
    };
  }

  private static OntologyChangeOperation concept(final String name) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.UPSERT_CONCEPT)
        .withConcept(
            new OntologyConcept()
                .withId(UUID.randomUUID())
                .withName(name)
                .withIri(URI.create("https://example.org/" + name)));
  }

  private static OntologyChangeOperation concept(final String name, final String replacedBy) {
    final OntologyChangeOperation operation = concept(name);
    operation.getConcept().setReplacedBy(replacedBy == null ? null : iri(replacedBy));
    return operation;
  }

  private static OntologyChangeOperation property(
      final String name, final String inverse, final String replacedBy) {
    final OntologyChangeOperation operation = property(name);
    operation.getProperty().setInverse(inverse == null ? null : iri(inverse));
    operation.getProperty().setReplacedBy(replacedBy == null ? null : iri(replacedBy));
    return operation;
  }

  private static URI iri(final String name) {
    return URI.create("https://example.org/" + name);
  }

  private static OntologyChangeOperation property(final String name) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.UPSERT_PROPERTY)
        .withProperty(
            new OntologyProperty()
                .withId(UUID.randomUUID())
                .withName(name)
                .withIri(URI.create("https://example.org/" + name)));
  }

  private static OntologyChangeOperation axiom(final String name) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.UPSERT_AXIOM)
        .withAxiom(
            new OntologyAxiom()
                .withId(UUID.randomUUID())
                .withName(name)
                .withSubjectIri(URI.create("https://example.org/" + name)));
  }
}
