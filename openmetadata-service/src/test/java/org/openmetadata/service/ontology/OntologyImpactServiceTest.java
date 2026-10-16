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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.auth0.jwt.exceptions.JWTVerificationException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BiConsumer;
import java.util.function.Supplier;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.api.data.DeleteOntologyResource;
import org.openmetadata.schema.api.data.OntologyDeleteResult;
import org.openmetadata.schema.api.data.OntologyImpactOperation;
import org.openmetadata.schema.api.data.OntologyImpactReport;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.security.jwt.InternalActionTokenSigner;
import org.openmetadata.service.security.jwt.InternalActionTokenSigner.Claims;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil.DeleteResponse;

@ExtendWith(MockitoExtension.class)
class OntologyImpactServiceTest {
  private static final UUID TERM_ID = UUID.fromString("819e8871-7306-4837-bc30-b0e9c458c54e");
  private static final UUID CHILD_ID = UUID.fromString("b67ae96a-b609-4122-b2fc-f5eefbf4d317");
  private static final UUID ASSET_ID = UUID.fromString("a2980889-bd2d-469c-8480-b48f1b0c2d94");
  private static final Instant NOW = Instant.parse("2026-07-18T21:00:00Z");
  private static final String PRINCIPAL = "alice";
  private static final BiConsumer<Supplier<List<UUID>>, MetadataOperation> ALLOW_ALL =
      (ids, operation) -> {};
  private static final BiConsumer<Supplier<List<UUID>>, MetadataOperation> REJECT_AUTHORIZATION =
      (id, operation) -> {
        throw new AssertionError(
            "Invalid requests must be rejected before descendant authorization");
      };

  @Mock private GlossaryTermRepository repository;
  @Mock private InternalActionTokenSigner tokenSigner;
  private final Fields fields = new Fields(Set.of("relatedTerms", "conceptMappings"));

  private final AtomicReference<Claims> signedClaims = new AtomicReference<>();
  private GlossaryTerm term;
  private EntityReference child;
  private OntologyImpactService service;

  @BeforeEach
  void setUp() {
    term = term();
    child = reference(Entity.GLOSSARY_TERM, CHILD_ID, "Risk.Child");
    service =
        new OntologyImpactService(
            repository, tokenSigner, Clock.fixed(NOW, ZoneOffset.UTC), Duration.ofMinutes(2));
    stubTokenSigning();
  }

  @Test
  void returnsTypedVersionBoundDeleteImpact() {
    stubSnapshot(List.of(child), 2);

    final OntologyImpactReport report = service.previewDelete(TERM_ID, PRINCIPAL);

    assertEquals(OntologyImpactOperation.DELETE, report.getOperation());
    assertEquals(1.2, report.getBaseVersion());
    assertEquals(NOW.plusSeconds(120).toEpochMilli(), report.getExpiresAt());
    assertEquals(List.of(child), report.getChildren());
    assertEquals(2, report.getBoundAssetCount());
    assertTrue(report.getBoundAssetsTruncated());
    assertEquals(TERM_ID.toString(), signedClaims.get().subject());
  }

  @Test
  void requiresReassignmentOrExplicitCascadeForChildren() {
    stubSnapshot(List.of(child), 1);
    final String token = service.previewDelete(TERM_ID, PRINCIPAL).getImpactToken();
    stubTokenVerification();
    final DeleteOntologyResource request = request(token);

    assertThrows(
        IllegalArgumentException.class,
        () -> service.delete(TERM_ID, request, PRINCIPAL, ALLOW_ALL));
    verify(repository, never()).delete(anyString(), any(), anyBoolean(), anyBoolean());
  }

  @Test
  void reassignsChildrenBeforeNonRecursiveDeletion() {
    stubSnapshot(List.of(child), 1);
    final String token = service.previewDelete(TERM_ID, PRINCIPAL).getImpactToken();
    stubTokenVerification();
    final EntityReference target = reference(Entity.GLOSSARY, UUID.randomUUID(), "Risk");
    final DeleteOntologyResource request = request(token).withReassignChildrenTo(target);
    when(repository.delete(PRINCIPAL, TERM_ID, false, false))
        .thenReturn(new DeleteResponse<>(term, null));

    final OntologyDeleteResult result = service.delete(TERM_ID, request, PRINCIPAL, ALLOW_ALL);

    assertEquals(1, result.getReassignedChildren());
    assertFalse(result.getCascaded());
    verify(repository).validateMoveOperation(eq(CHILD_ID), any());
    verify(repository).moveGlossaryTerm(eq(CHILD_ID), any(), eq(PRINCIPAL));
    verify(repository).delete(PRINCIPAL, TERM_ID, false, false);
  }

  @Test
  void rejectsImpactWhenDependenciesChangedAfterPreview() {
    stubSnapshot(List.of(), 1, 2);
    final String token = service.previewDelete(TERM_ID, PRINCIPAL).getImpactToken();
    stubTokenVerification();

    assertThrows(
        IllegalArgumentException.class,
        () -> service.delete(TERM_ID, request(token), PRINCIPAL, ALLOW_ALL));
    verify(repository, never()).delete(anyString(), any(), anyBoolean(), anyBoolean());
  }

  @Test
  void rejectsInvalidTokenBeforeAuthorizingDescendants() {
    stubSnapshot(List.of(child), 1);
    final String token = service.previewDelete(TERM_ID, PRINCIPAL).getImpactToken();
    when(tokenSigner.verify(token, "ontology-delete"))
        .thenThrow(new JWTVerificationException("invalid token"));

    assertThrows(
        IllegalArgumentException.class,
        () ->
            service.delete(
                TERM_ID,
                request(token).withCascadeConfirmed(true),
                PRINCIPAL,
                REJECT_AUTHORIZATION));
  }

  @Test
  void rejectsAnotherPrincipalsTokenBeforeAuthorizingDescendants() {
    stubSnapshot(List.of(child), 1);
    final String token = service.previewDelete(TERM_ID, "bob").getImpactToken();
    stubTokenVerification();

    assertThrows(
        IllegalArgumentException.class,
        () ->
            service.delete(
                TERM_ID,
                request(token).withCascadeConfirmed(true),
                PRINCIPAL,
                REJECT_AUTHORIZATION));
  }

  @Test
  void rejectsConflictingChildHandlingChoicesBeforeAuthorizingDescendants() {
    stubSnapshot(List.of(child), 1);
    final String token = service.previewDelete(TERM_ID, PRINCIPAL).getImpactToken();
    stubTokenVerification();
    final DeleteOntologyResource request =
        request(token)
            .withCascadeConfirmed(true)
            .withReassignChildrenTo(reference(Entity.GLOSSARY, UUID.randomUUID(), "Other"));

    assertThrows(
        IllegalArgumentException.class,
        () -> service.delete(TERM_ID, request, PRINCIPAL, REJECT_AUTHORIZATION));
  }

  @ParameterizedTest
  @MethodSource("invalidReassignmentTargets")
  void rejectsInvalidReassignmentBeforeAuthorizingDescendants(final EntityReference target) {
    stubSnapshot(List.of(child), 1);
    final String token = service.previewDelete(TERM_ID, PRINCIPAL).getImpactToken();
    stubTokenVerification();

    assertThrows(
        IllegalArgumentException.class,
        () ->
            service.delete(
                TERM_ID,
                request(token).withReassignChildrenTo(target),
                PRINCIPAL,
                REJECT_AUTHORIZATION));
  }

  private static Stream<EntityReference> invalidReassignmentTargets() {
    return Stream.of(
        reference(Entity.GLOSSARY_TERM, TERM_ID, "Risk"),
        reference(Entity.GLOSSARY_TERM, CHILD_ID, "Risk.Child"),
        reference(Entity.TABLE, ASSET_ID, "service.db.table"),
        new EntityReference().withType(Entity.GLOSSARY));
  }

  private void stubSnapshot(
      final List<EntityReference> children,
      final Integer firstAssetCount,
      final Integer... remainingAssetCounts) {
    when(repository.getFields(anyString())).thenReturn(fields);
    when(repository.get(isNull(), eq(TERM_ID), eq(fields), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(term);
    when(repository.findTo(
            TERM_ID, Entity.GLOSSARY_TERM, Relationship.CONTAINS, Entity.GLOSSARY_TERM))
        .thenReturn(children);
    when(repository.getGlossaryTermAssets(TERM_ID, OntologyImpactService.ASSET_PREVIEW_LIMIT, 0))
        .thenReturn(
            new ResultList<>(List.of(reference(Entity.TABLE, ASSET_ID, "service.db.table"))));
    when(repository.getGlossaryTermAssetCount(term.getFullyQualifiedName()))
        .thenReturn(firstAssetCount, remainingAssetCounts);
  }

  private void stubTokenSigning() {
    when(tokenSigner.sign(any(Claims.class)))
        .thenAnswer(
            invocation -> {
              signedClaims.set(invocation.getArgument(0));
              return "signed-impact-token";
            });
  }

  private void stubTokenVerification() {
    when(tokenSigner.verify("signed-impact-token", "ontology-delete"))
        .thenAnswer(invocation -> signedClaims.get());
  }

  private static DeleteOntologyResource request(final String token) {
    return new DeleteOntologyResource()
        .withImpactToken(token)
        .withCascadeConfirmed(false)
        .withHardDelete(false);
  }

  private static GlossaryTerm term() {
    return new GlossaryTerm()
        .withId(TERM_ID)
        .withName("Risk")
        .withFullyQualifiedName("Risk")
        .withDescription("Risk concept")
        .withVersion(1.2)
        .withUpdatedAt(NOW.toEpochMilli())
        .withRelatedTerms(List.of())
        .withConceptMappings(List.of());
  }

  private static EntityReference reference(
      final String type, final UUID id, final String fullyQualifiedName) {
    return new EntityReference()
        .withId(id)
        .withType(type)
        .withName(fullyQualifiedName)
        .withFullyQualifiedName(fullyQualifiedName);
  }
}
