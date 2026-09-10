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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyAttribute;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.OntologyAxiomRepository;
import org.openmetadata.service.ontology.OntologyChangeOperationExecutor.OperationOutcome;
import org.openmetadata.service.util.RestUtil.DeleteResponse;
import org.openmetadata.service.util.RestUtil.PutResponse;

class OntologyChangeOperationExecutorTest {
  private static final String USER = "steward";
  private static final long NOW = 1_750_000_000_000L;
  private static final URI CONCEPT_A = URI.create("http://example.org/concepts/a");
  private static final URI CONCEPT_B = URI.create("http://example.org/concepts/b");
  private static final URI SCHEME = URI.create("http://example.org/schemes/main");
  private static final URI SCHEME_OTHER = URI.create("http://example.org/schemes/other");

  private final UriInfo uriInfo = mock(UriInfo.class);
  private final GlossaryTermRepository termRepository = mock(GlossaryTermRepository.class);
  private final OntologyAxiomRepository axiomRepository = mock(OntologyAxiomRepository.class);
  private final Clock clock = Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC);
  private OntologyChangeOperationExecutor executor;

  @BeforeEach
  void setUp() {
    executor = new OntologyChangeOperationExecutor(termRepository, axiomRepository, clock);
  }

  @Test
  void upsertAttributeReplacesExistingAttributeWithSameId() {
    final UUID termId = UUID.randomUUID();
    final UUID attributeId = UUID.randomUUID();
    final GlossaryTerm stored =
        term(termId).withAttributes(List.of(attribute(attributeId, "old-value")));
    stubEditableTerm(termId, stored);
    stubTermUpsertEchoesEntity();
    final OntologyChangeOperation operation =
        operation(OntologyChangeOperationType.UPSERT_ATTRIBUTE, termId)
            .withAttribute(attribute(attributeId, "new-value"));

    final OperationOutcome outcome = executor.execute(uriInfo, USER, operation);

    final GlossaryTerm persisted = capturePersistedTerm();
    assertEquals(1, persisted.getAttributes().size());
    assertEquals(attributeId, persisted.getAttributes().getFirst().getId());
    assertEquals("new-value", persisted.getAttributes().getFirst().getName());
    assertEquals(termId, outcome.entity().getId());
    assertEquals(0.3, outcome.entityVersion());
  }

  @Test
  void upsertAttributeAddsNewAttributeWhenTermHasNone() {
    final UUID termId = UUID.randomUUID();
    final UUID attributeId = UUID.randomUUID();
    stubEditableTerm(termId, term(termId));
    stubTermUpsertEchoesEntity();
    final OntologyChangeOperation operation =
        operation(OntologyChangeOperationType.UPSERT_ATTRIBUTE, termId)
            .withAttribute(attribute(attributeId, "value"));

    executor.execute(uriInfo, USER, operation);

    final GlossaryTerm persisted = capturePersistedTerm();
    assertEquals(1, persisted.getAttributes().size());
    assertEquals(attributeId, persisted.getAttributes().getFirst().getId());
  }

  @Test
  void upsertMappingReplacesMatchingMappingAndKeepsDifferentOnes() {
    final UUID termId = UUID.randomUUID();
    final GlossaryTerm stored =
        term(termId)
            .withConceptMappings(
                List.of(
                    mapping(ConceptMapping.ConceptMappingType.EXACT_MATCH, CONCEPT_A, SCHEME),
                    mapping(ConceptMapping.ConceptMappingType.CLOSE_MATCH, CONCEPT_B, SCHEME)));
    stubEditableTerm(termId, stored);
    stubTermUpsertEchoesEntity();
    final OntologyChangeOperation operation =
        operation(OntologyChangeOperationType.UPSERT_MAPPING, termId)
            .withMapping(mapping(ConceptMapping.ConceptMappingType.EXACT_MATCH, CONCEPT_A, SCHEME));

    executor.execute(uriInfo, USER, operation);

    final GlossaryTerm persisted = capturePersistedTerm();
    assertEquals(2, persisted.getConceptMappings().size());
    assertEquals(
        1,
        countMappingsForConcept(persisted, CONCEPT_A),
        "matching mapping must not be duplicated");
    assertEquals(1, countMappingsForConcept(persisted, CONCEPT_B));
  }

  @Test
  void upsertMappingKeepsMappingWhenSchemeIriDiffers() {
    final UUID termId = UUID.randomUUID();
    final GlossaryTerm stored =
        term(termId)
            .withConceptMappings(
                List.of(mapping(ConceptMapping.ConceptMappingType.EXACT_MATCH, CONCEPT_A, SCHEME)));
    stubEditableTerm(termId, stored);
    stubTermUpsertEchoesEntity();
    final OntologyChangeOperation operation =
        operation(OntologyChangeOperationType.UPSERT_MAPPING, termId)
            .withMapping(
                mapping(ConceptMapping.ConceptMappingType.EXACT_MATCH, CONCEPT_A, SCHEME_OTHER));

    executor.execute(uriInfo, USER, operation);

    final GlossaryTerm persisted = capturePersistedTerm();
    assertEquals(2, persisted.getConceptMappings().size());
  }

  @Test
  void deleteMappingRemovesOnlyMatchingMapping() {
    final UUID termId = UUID.randomUUID();
    final GlossaryTerm stored =
        term(termId)
            .withConceptMappings(
                List.of(
                    mapping(ConceptMapping.ConceptMappingType.EXACT_MATCH, CONCEPT_A, SCHEME),
                    mapping(ConceptMapping.ConceptMappingType.CLOSE_MATCH, CONCEPT_B, SCHEME)));
    stubEditableTerm(termId, stored);
    stubTermUpsertEchoesEntity();
    final OntologyChangeOperation operation =
        operation(OntologyChangeOperationType.DELETE_MAPPING, termId)
            .withMapping(mapping(ConceptMapping.ConceptMappingType.EXACT_MATCH, CONCEPT_A, SCHEME));

    executor.execute(uriInfo, USER, operation);

    final GlossaryTerm persisted = capturePersistedTerm();
    assertEquals(1, persisted.getConceptMappings().size());
    assertEquals(CONCEPT_B, persisted.getConceptMappings().getFirst().getConceptIri());
  }

  @Test
  void deleteTermOnAlreadyDeletedTermSkipsRepositoryDelete() {
    final UUID termId = UUID.randomUUID();
    final GlossaryTerm alreadyDeleted = term(termId).withDeleted(true);
    when(termRepository.get(isNull(), eq(termId), any(), eq(Include.ALL), eq(false)))
        .thenReturn(alreadyDeleted);
    final OntologyChangeOperation operation =
        operation(OntologyChangeOperationType.DELETE_TERM, termId);

    final OperationOutcome outcome = executor.execute(uriInfo, USER, operation);

    verify(termRepository, never()).delete(any(), any(), eq(false), eq(false));
    assertEquals(termId, outcome.entity().getId());
    assertTrue(outcome.entity().getDeleted());
  }

  @Test
  void deleteTermDeletesActiveTerm() {
    final UUID termId = UUID.randomUUID();
    final GlossaryTerm active = term(termId).withDeleted(false);
    final GlossaryTerm deleted = term(termId).withDeleted(true);
    when(termRepository.get(isNull(), eq(termId), any(), eq(Include.ALL), eq(false)))
        .thenReturn(active);
    when(termRepository.delete(eq(USER), eq(termId), eq(false), eq(false)))
        .thenReturn(new DeleteResponse<>(deleted, EventType.ENTITY_DELETED));
    final OntologyChangeOperation operation =
        operation(OntologyChangeOperationType.DELETE_TERM, termId);

    final OperationOutcome outcome = executor.execute(uriInfo, USER, operation);

    verify(termRepository).delete(USER, termId, false, false);
    assertEquals(termId, outcome.entity().getId());
    assertTrue(outcome.entity().getDeleted());
  }

  @Test
  void deleteAxiomOnAlreadyDeletedAxiomSkipsRepositoryDelete() {
    final UUID axiomId = UUID.randomUUID();
    final OntologyAxiom alreadyDeleted = axiom(axiomId).withDeleted(true);
    when(axiomRepository.get(isNull(), eq(axiomId), any(), eq(Include.ALL), eq(false)))
        .thenReturn(alreadyDeleted);
    final OntologyChangeOperation operation =
        operation(OntologyChangeOperationType.DELETE_AXIOM, axiomId);

    final OperationOutcome outcome = executor.execute(uriInfo, USER, operation);

    verify(axiomRepository, never()).delete(any(), any(), eq(false), eq(false));
    assertEquals(axiomId, outcome.entity().getId());
  }

  @Test
  void deleteAxiomDeletesActiveAxiom() {
    final UUID axiomId = UUID.randomUUID();
    final OntologyAxiom active = axiom(axiomId).withDeleted(false);
    final OntologyAxiom deleted = axiom(axiomId).withDeleted(true);
    when(axiomRepository.get(isNull(), eq(axiomId), any(), eq(Include.ALL), eq(false)))
        .thenReturn(active);
    when(axiomRepository.delete(eq(USER), eq(axiomId), eq(false), eq(false)))
        .thenReturn(new DeleteResponse<>(deleted, EventType.ENTITY_DELETED));
    final OntologyChangeOperation operation =
        operation(OntologyChangeOperationType.DELETE_AXIOM, axiomId);

    final OperationOutcome outcome = executor.execute(uriInfo, USER, operation);

    verify(axiomRepository).delete(USER, axiomId, false, false);
    assertEquals(axiomId, outcome.entity().getId());
  }

  @Test
  void upsertAxiomWithTargetIdPreparesAsUpdate() {
    final UUID axiomId = UUID.randomUUID();
    stubAxiomUpsertEchoesEntity();
    final OntologyChangeOperation operation =
        operation(OntologyChangeOperationType.UPSERT_AXIOM, axiomId).withAxiom(axiom(axiomId));

    executor.execute(uriInfo, USER, operation);

    verify(axiomRepository).prepareInternal(any(OntologyAxiom.class), eq(true));
    verify(axiomRepository, never()).prepareInternal(any(OntologyAxiom.class), eq(false));
  }

  @Test
  void upsertAxiomWithoutTargetIdPreparesAsCreate() {
    final UUID axiomId = UUID.randomUUID();
    stubAxiomUpsertEchoesEntity();
    final OntologyChangeOperation operation =
        operation(OntologyChangeOperationType.UPSERT_AXIOM, null).withAxiom(axiom(axiomId));

    executor.execute(uriInfo, USER, operation);

    verify(axiomRepository).prepareInternal(any(OntologyAxiom.class), eq(false));
    verify(axiomRepository, never()).prepareInternal(any(OntologyAxiom.class), eq(true));
  }

  @Test
  void upsertAxiomStampsUpdatedByAndUpdatedAt() {
    final UUID axiomId = UUID.randomUUID();
    stubAxiomUpsertEchoesEntity();
    final OntologyChangeOperation operation =
        operation(OntologyChangeOperationType.UPSERT_AXIOM, axiomId).withAxiom(axiom(axiomId));

    executor.execute(uriInfo, USER, operation);

    final ArgumentCaptor<OntologyAxiom> captor = ArgumentCaptor.forClass(OntologyAxiom.class);
    verify(axiomRepository).createOrUpdate(eq(uriInfo), captor.capture(), eq(USER));
    assertEquals(USER, captor.getValue().getUpdatedBy());
    assertEquals(NOW, captor.getValue().getUpdatedAt());
  }

  private void stubEditableTerm(final UUID termId, final GlossaryTerm term) {
    when(termRepository.get(isNull(), eq(termId), any(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(term);
  }

  private void stubTermUpsertEchoesEntity() {
    when(termRepository.createOrUpdate(eq(uriInfo), any(GlossaryTerm.class), eq(USER)))
        .thenAnswer(
            invocation ->
                new PutResponse<>(
                    Response.Status.OK,
                    invocation.getArgument(1, GlossaryTerm.class),
                    EventType.ENTITY_UPDATED));
  }

  private void stubAxiomUpsertEchoesEntity() {
    when(axiomRepository.createOrUpdate(eq(uriInfo), any(OntologyAxiom.class), eq(USER)))
        .thenAnswer(
            invocation ->
                new PutResponse<>(
                    Response.Status.OK,
                    invocation.getArgument(1, OntologyAxiom.class),
                    EventType.ENTITY_UPDATED));
  }

  private GlossaryTerm capturePersistedTerm() {
    final ArgumentCaptor<GlossaryTerm> captor = ArgumentCaptor.forClass(GlossaryTerm.class);
    verify(termRepository).createOrUpdate(eq(uriInfo), captor.capture(), eq(USER));
    return captor.getValue();
  }

  private static long countMappingsForConcept(final GlossaryTerm term, final URI conceptIri) {
    return term.getConceptMappings().stream()
        .filter(mapping -> conceptIri.equals(mapping.getConceptIri()))
        .count();
  }

  private static GlossaryTerm term(final UUID termId) {
    return new GlossaryTerm()
        .withId(termId)
        .withName("term1")
        .withFullyQualifiedName("glossary.term1")
        .withVersion(0.3);
  }

  private static OntologyAttribute attribute(final UUID attributeId, final String name) {
    return new OntologyAttribute().withId(attributeId).withName(name);
  }

  private static ConceptMapping mapping(
      final ConceptMapping.ConceptMappingType type, final URI conceptIri, final URI schemeIri) {
    return new ConceptMapping()
        .withMappingType(type)
        .withConceptIri(conceptIri)
        .withSchemeIri(schemeIri);
  }

  private static OntologyAxiom axiom(final UUID axiomId) {
    return new OntologyAxiom()
        .withId(axiomId)
        .withName("axiom1")
        .withFullyQualifiedName("ontology.axiom1")
        .withVersion(0.5);
  }

  private static OntologyChangeOperation operation(
      final OntologyChangeOperationType type, final UUID targetId) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(type)
        .withTargetId(targetId)
        .withBaseVersion(0.1);
  }
}
