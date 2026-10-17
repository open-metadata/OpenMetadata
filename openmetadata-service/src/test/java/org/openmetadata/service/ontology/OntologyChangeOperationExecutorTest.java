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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
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
  private final GlossaryRepository glossaryRepository = mock(GlossaryRepository.class);
  private final Clock clock = Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC);
  private OntologyChangeOperationExecutor executor;

  @BeforeEach
  void setUp() {
    executor = new OntologyChangeOperationExecutor(glossaryRepository, termRepository, clock);
  }

  @Test
  void createsGlossaryOnlyWhenItsStudioOperationExecutes() {
    final Glossary glossary =
        new Glossary()
            .withId(UUID.randomUUID())
            .withName("Sales")
            .withFullyQualifiedName("Sales")
            .withDescription("Sales concepts");
    when(glossaryRepository.getByNameOrNull(
            isNull(), eq("Sales"), isNull(), eq(Include.ALL), eq(false)))
        .thenReturn(Optional.empty());
    when(glossaryRepository.createOrUpdate(eq(uriInfo), any(Glossary.class), eq(USER)))
        .thenAnswer(
            invocation ->
                new PutResponse<>(
                    Response.Status.CREATED,
                    invocation.getArgument(1, Glossary.class),
                    EventType.ENTITY_CREATED));
    final OntologyChangeOperation operation =
        new OntologyChangeOperation()
            .withId(UUID.randomUUID())
            .withOperationType(OntologyChangeOperationType.CREATE_GLOSSARY)
            .withGlossary(glossary);

    final OperationOutcome outcome = executor.execute(uriInfo, USER, operation);

    assertEquals(glossary.getId(), outcome.entity().getId());
    final ArgumentCaptor<Glossary> persisted = ArgumentCaptor.forClass(Glossary.class);
    verify(glossaryRepository).createOrUpdate(eq(uriInfo), persisted.capture(), eq(USER));
    assertEquals(NOW, persisted.getValue().getUpdatedAt());
    assertEquals(USER, persisted.getValue().getUpdatedBy());
    verify(glossaryRepository).prepareInternal(any(Glossary.class), eq(false));
  }

  @Test
  void neverOverwritesAnExistingGlossaryDuringCreate() {
    final Glossary glossary =
        new Glossary()
            .withId(UUID.randomUUID())
            .withName("Sales")
            .withFullyQualifiedName("Sales")
            .withDescription("Sales concepts");
    when(glossaryRepository.getByNameOrNull(
            isNull(), eq("Sales"), isNull(), eq(Include.ALL), eq(false)))
        .thenReturn(Optional.of(glossary));
    final OntologyChangeOperation operation =
        new OntologyChangeOperation()
            .withId(UUID.randomUUID())
            .withOperationType(OntologyChangeOperationType.CREATE_GLOSSARY)
            .withGlossary(glossary);

    assertThrows(BadRequestException.class, () -> executor.execute(uriInfo, USER, operation));
    verify(glossaryRepository, never()).createOrUpdate(any(), any(), any());
  }

  @Test
  void createTermKeepsMemoryEvidenceOnTheDraftOperation() {
    final UUID memoryId = UUID.randomUUID();
    stubTermUpsertEchoesEntity();
    final OntologyChangeOperation operation =
        operation(OntologyChangeOperationType.CREATE_TERM, null)
            .withTerm(term(UUID.randomUUID()))
            .withSourceMemoryIds(Set.of(memoryId));

    executor.execute(uriInfo, USER, operation);

    assertEquals(operation.getTerm().getId(), capturePersistedTerm().getId());
    assertEquals(Set.of(memoryId), operation.getSourceMemoryIds());
  }

  @Test
  void createTermNeverOverwritesATermThatClaimedTheNameAfterDrafting() {
    final GlossaryTerm proposed = term(UUID.randomUUID());
    when(termRepository.getByNameOrNull(
            isNull(), eq("glossary.term1"), isNull(), eq(Include.ALL), eq(false)))
        .thenReturn(Optional.of(term(UUID.randomUUID())));
    final OntologyChangeOperation operation =
        operation(OntologyChangeOperationType.CREATE_TERM, null).withTerm(proposed);

    assertThrows(BadRequestException.class, () -> executor.execute(uriInfo, USER, operation));
    verify(termRepository, never()).createOrUpdate(any(), any(), any());
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
    stubPersistTermEchoesEntity();
    final OntologyChangeOperation operation =
        operation(OntologyChangeOperationType.UPSERT_MAPPING, termId)
            .withMapping(mapping(ConceptMapping.ConceptMappingType.EXACT_MATCH, CONCEPT_A, SCHEME));

    executor.execute(uriInfo, USER, operation);

    final FieldUpdate update = captureFieldUpdate();
    final GlossaryTerm persisted = update.term;
    assertEquals(Set.of("conceptMappings"), update.patchedFields);
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
    stubPersistTermEchoesEntity();
    final OntologyChangeOperation operation =
        operation(OntologyChangeOperationType.UPSERT_MAPPING, termId)
            .withMapping(
                mapping(ConceptMapping.ConceptMappingType.EXACT_MATCH, CONCEPT_A, SCHEME_OTHER));

    executor.execute(uriInfo, USER, operation);

    final FieldUpdate update = captureFieldUpdate();
    assertEquals(Set.of("conceptMappings"), update.patchedFields);
    assertEquals(2, update.term.getConceptMappings().size());
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
    stubPersistTermEchoesEntity();
    final OntologyChangeOperation operation =
        operation(OntologyChangeOperationType.DELETE_MAPPING, termId)
            .withMapping(mapping(ConceptMapping.ConceptMappingType.EXACT_MATCH, CONCEPT_A, SCHEME));

    executor.execute(uriInfo, USER, operation);

    final FieldUpdate update = captureFieldUpdate();
    assertEquals(Set.of("conceptMappings"), update.patchedFields);
    assertEquals(1, update.term.getConceptMappings().size());
    assertEquals(CONCEPT_B, update.term.getConceptMappings().getFirst().getConceptIri());
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
  void glossaryChangeSetsRejectNativeAxiomOperations() {
    for (final var type :
        List.of(
            OntologyChangeOperationType.UPSERT_AXIOM, OntologyChangeOperationType.DELETE_AXIOM)) {
      final var operation = operation(type, UUID.randomUUID());
      assertThrows(BadRequestException.class, () -> executor.execute(uriInfo, USER, operation));
      assertThrows(
          BadRequestException.class,
          () ->
              OntologyChangeSetValidator.normalizeAndValidate(
                  new OntologyChangeSet().withOperations(List.of(operation))));
      final var preflight =
          new OntologyChangePreflight(
              (entityType, id) -> {
                throw new AssertionError("Unsupported operations must not load entities");
              });
      assertThrows(
          BadRequestException.class,
          () ->
              preflight.validate(
                  new OntologyChangeSet().withGlossaries(List.of()), List.of(operation)));
    }
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

  /**
   * Stubs the field-scoped store path ({@code createOrUpdate} with {@code patchedFields}) used by
   * the attribute/mapping operations, and echoes the mutated term back so assertions can inspect
   * what was persisted.
   */
  @SuppressWarnings("unchecked")
  private void stubPersistTermEchoesEntity() {
    when(termRepository.createOrUpdate(
            eq(uriInfo), any(GlossaryTerm.class), eq(USER), isNull(), any(Set.class)))
        .thenAnswer(
            invocation ->
                new PutResponse<>(
                    Response.Status.OK,
                    invocation.getArgument(1, GlossaryTerm.class),
                    EventType.ENTITY_UPDATED));
  }

  /** The term and the field scope the executor asked the repository to persist. */
  private static final class FieldUpdate {
    final GlossaryTerm term;
    final Set<String> patchedFields;

    FieldUpdate(GlossaryTerm term, Set<String> patchedFields) {
      this.term = term;
      this.patchedFields = patchedFields;
    }
  }

  @SuppressWarnings("unchecked")
  private FieldUpdate captureFieldUpdate() {
    final ArgumentCaptor<GlossaryTerm> termCaptor = ArgumentCaptor.forClass(GlossaryTerm.class);
    final ArgumentCaptor<Set<String>> fieldsCaptor = ArgumentCaptor.forClass(Set.class);
    verify(termRepository)
        .createOrUpdate(
            eq(uriInfo), termCaptor.capture(), eq(USER), isNull(), fieldsCaptor.capture());
    return new FieldUpdate(termCaptor.getValue(), fieldsCaptor.getValue());
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

  private static ConceptMapping mapping(
      final ConceptMapping.ConceptMappingType type, final URI conceptIri, final URI schemeIri) {
    return new ConceptMapping()
        .withMappingType(type)
        .withConceptIri(conceptIri)
        .withSchemeIri(schemeIri);
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
