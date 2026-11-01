/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.resources.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.AuditReport;
import org.openmetadata.schema.entity.ai.AuditReportArtifact;
import org.openmetadata.schema.entity.ai.AuditReportFormat;
import org.openmetadata.schema.entity.ai.AuditReportManifest;
import org.openmetadata.schema.entity.ai.AuditReportScope;
import org.openmetadata.schema.entity.ai.AuditReportStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class AuditPackGeneratorTest {

  static {
    // Entity.registerEntity populates this at server startup; unit tests have no registry.
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("aiapplication", Entity.AI_APPLICATION);
  }

  private static final long NOW = 1_000_000_000L;
  private static final long STALE_MILLIS = 15 * 60 * 1000L;

  @Test
  void isInterrupted_queuedIsAlwaysInterrupted() {
    assertTrue(AuditPackGenerator.isInterrupted(report(AuditReportStatus.Queued, null), NOW));
  }

  @Test
  void isInterrupted_runningIsStaleOnlyPastThreshold() {
    assertFalse(
        AuditPackGenerator.isInterrupted(report(AuditReportStatus.Running, NOW - 60_000L), NOW));
    assertTrue(
        AuditPackGenerator.isInterrupted(
            report(AuditReportStatus.Running, NOW - STALE_MILLIS - 1), NOW));
    assertTrue(AuditPackGenerator.isInterrupted(report(AuditReportStatus.Running, null), NOW));
  }

  @Test
  void isInterrupted_terminalStatesAreNeverInterrupted() {
    assertFalse(AuditPackGenerator.isInterrupted(report(AuditReportStatus.Completed, NOW), NOW));
    assertFalse(AuditPackGenerator.isInterrupted(report(AuditReportStatus.Failed, NOW), NOW));
    assertFalse(AuditPackGenerator.isInterrupted(report(AuditReportStatus.Cancelled, NOW), NOW));
  }

  @Test
  void signatureOf_matchesForSameRequestAndDiffersOtherwise() {
    UUID domainId = UUID.randomUUID();
    assertEquals(
        AuditPackGenerator.signatureOf(domainReport(domainId)),
        AuditPackGenerator.signatureOf(domainReport(domainId)));

    assertNotEquals(
        AuditPackGenerator.signatureOf(domainReport(domainId)),
        AuditPackGenerator.signatureOf(domainReport(UUID.randomUUID())));
  }

  @Test
  void signatureOf_differsByRequester() {
    UUID domainId = UUID.randomUUID();
    AuditReport first = domainReport(domainId).withUpdatedBy("alice");
    AuditReport second = domainReport(domainId).withUpdatedBy("bob");

    assertNotEquals(AuditPackGenerator.signatureOf(first), AuditPackGenerator.signatureOf(second));
  }

  @Test
  void stampRequestSignature_isDeterministicAndRequestSpecific() {
    UUID domainId = UUID.randomUUID();
    AuditReport first = domainReport(domainId).withUpdatedBy("alice");
    AuditReport second = domainReport(domainId).withUpdatedBy("alice");
    AuditPackGenerator.stampRequestSignature(first);
    AuditPackGenerator.stampRequestSignature(second);
    assertNotNull(first.getRequestSignature());
    assertEquals(first.getRequestSignature(), second.getRequestSignature());

    AuditReport different = domainReport(UUID.randomUUID());
    AuditPackGenerator.stampRequestSignature(different);
    assertNotEquals(first.getRequestSignature(), different.getRequestSignature());

    AuditReport differentRequester = domainReport(domainId).withUpdatedBy("bob");
    AuditPackGenerator.stampRequestSignature(differentRequester);
    assertNotEquals(first.getRequestSignature(), differentRequester.getRequestSignature());
  }

  @Nested
  class ArtifactSelection {

    private static final byte[] PDF_BYTES = {'%', 'P', 'D', 'F'};

    @AfterEach
    void clearRenderer() {
      AuditPackGenerator.setPdfRenderer(null);
    }

    @Test
    void jsonFormatNeverInvokesTheRenderer() {
      AuditPackGenerator.setPdfRenderer(
          (document, manifest) -> {
            throw new AssertionError("renderer must not be called for a Json pack");
          });

      assertEquals(
          List.of(AuditReportFormat.Json), formatsOf(artifactsFor(AuditReportFormat.Json)));
    }

    @Test
    void pdfFormatEmitsOnlyThePdfWhenARendererIsRegistered() {
      AuditPackGenerator.setPdfRenderer((document, manifest) -> Optional.of(PDF_BYTES));

      List<AuditReportArtifact> artifacts = artifactsFor(AuditReportFormat.Pdf);

      assertEquals(List.of(AuditReportFormat.Pdf), formatsOf(artifacts));
      assertTrue(artifacts.get(0).getDownloadUrl().startsWith("data:application/pdf;base64,"));
    }

    @Test
    void bothFormatEmitsJsonAndPdf() {
      AuditPackGenerator.setPdfRenderer((document, manifest) -> Optional.of(PDF_BYTES));

      assertEquals(
          List.of(AuditReportFormat.Json, AuditReportFormat.Pdf),
          formatsOf(artifactsFor(AuditReportFormat.Both)));
    }

    /** A Completed pack must always carry something downloadable. */
    @Test
    void pdfFormatFallsBackToJsonWhenNoRendererIsRegistered() {
      assertEquals(List.of(AuditReportFormat.Json), formatsOf(artifactsFor(AuditReportFormat.Pdf)));
    }

    @Test
    void pdfFormatFallsBackToJsonWhenTheRendererDeclines() {
      AuditPackGenerator.setPdfRenderer((document, manifest) -> Optional.empty());

      assertEquals(List.of(AuditReportFormat.Json), formatsOf(artifactsFor(AuditReportFormat.Pdf)));
    }

    /**
     * Renderers are supplied by the distribution. One that ignores the never-throw contract must
     * not take the pack down with it — the exception would otherwise reach run(...) and mark the
     * whole report Failed.
     */
    @Test
    void pdfFormatFallsBackToJsonWhenTheRendererThrows() {
      AuditPackGenerator.setPdfRenderer(
          (document, manifest) -> {
            throw new IllegalStateException("template blew up");
          });

      assertEquals(List.of(AuditReportFormat.Json), formatsOf(artifactsFor(AuditReportFormat.Pdf)));
    }

    @Test
    void bothFormatStillEmitsJsonWhenTheRendererThrows() {
      AuditPackGenerator.setPdfRenderer(
          (document, manifest) -> {
            throw new IllegalStateException("template blew up");
          });

      assertEquals(
          List.of(AuditReportFormat.Json), formatsOf(artifactsFor(AuditReportFormat.Both)));
    }

    /** A null Optional violates the contract too, and must not NPE the job. */
    @Test
    void pdfFormatFallsBackToJsonWhenTheRendererReturnsNull() {
      AuditPackGenerator.setPdfRenderer((document, manifest) -> null);

      assertEquals(List.of(AuditReportFormat.Json), formatsOf(artifactsFor(AuditReportFormat.Pdf)));
    }

    @Test
    void bothFormatStillEmitsJsonWhenTheRendererDeclines() {
      AuditPackGenerator.setPdfRenderer((document, manifest) -> Optional.empty());

      assertEquals(
          List.of(AuditReportFormat.Json), formatsOf(artifactsFor(AuditReportFormat.Both)));
    }

    @Test
    void unsetFormatKeepsTheHistoricalJsonOnlyBehaviour() {
      AuditPackGenerator.setPdfRenderer((document, manifest) -> Optional.of(PDF_BYTES));

      assertEquals(List.of(AuditReportFormat.Json), formatsOf(artifactsFor(null)));
    }

    private List<AuditReportArtifact> artifactsFor(AuditReportFormat format) {
      AuditPackDocument document =
          new AuditPackDocument("id", "pack", "Estate", null, null, null, NOW, List.of());
      return AuditPackGenerator.buildArtifacts(
          new AuditReport().withFormat(format), document, new AuditReportManifest());
    }

    private List<AuditReportFormat> formatsOf(List<AuditReportArtifact> artifacts) {
      return artifacts.stream().map(AuditReportArtifact::getFormat).toList();
    }
  }

  @Test
  void requesterVisibilityFailsClosedWhenRequesterIsNotRecorded() {
    AuditReport missing = new AuditReport().withId(UUID.randomUUID());
    assertThrows(
        IllegalStateException.class, () -> AuditPackGenerator.requesterVisibility(missing));

    AuditReport blank =
        new AuditReport()
            .withId(UUID.randomUUID())
            .withRequestedBy(new EntityReference().withType("user"));
    assertThrows(IllegalStateException.class, () -> AuditPackGenerator.requesterVisibility(blank));
  }

  @Test
  @SuppressWarnings("unchecked")
  void requesterVisibilityPacksOnlyAssetsTheRequesterMayView() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> authMock = mockStatic(DefaultAuthorizer.class)) {
      UUID visibleId = UUID.randomUUID();
      UUID hiddenId = UUID.randomUUID();
      EntityRepository<AIApplication> repository = mock(EntityRepository.class);
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.AI_APPLICATION))
          .thenReturn(repository);
      when(repository.getFields(anyString())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
      // ResourceContext#getEntity() resolves the entity through this get; hand back an asset
      // carrying the requested id so the authorize answer below can tell the two apart.
      when(repository.get(any(), any(), any(), any(RelationIncludes.class), anyBoolean()))
          .thenAnswer(invocation -> application(invocation.getArgument(1, UUID.class)));
      authMock
          .when(() -> DefaultAuthorizer.authorizeUser(anyString(), any(), any()))
          .thenAnswer(
              invocation -> {
                ResourceContextInterface context = invocation.getArgument(2);
                EntityInterface<?> entity = context.getEntity();
                if (entity != null && hiddenId.equals(entity.getId())) {
                  throw new AuthorizationException("operation ViewBasic denied");
                }
                return null;
              });
      AuditReport report =
          new AuditReport()
              .withId(UUID.randomUUID())
              .withRequestedBy(
                  new EntityReference().withType("user").withFullyQualifiedName("mallory"));

      AIAssetVisibility visibility = AuditPackGenerator.requesterVisibility(report);
      List<EntityInterface<?>> packed =
          visibility.filter(List.of(application(visibleId), application(hiddenId)));

      assertEquals(1, packed.size());
      assertEquals(visibleId, packed.get(0).getId());
    }
  }

  @Test
  @SuppressWarnings("unchecked")
  void requesterVisibilityCoversTheEstateForAnAdminRequester() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<SubjectContext> subjectMock = mockStatic(SubjectContext.class)) {
      EntityRepository<AIApplication> repository = mock(EntityRepository.class);
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.AI_APPLICATION))
          .thenReturn(repository);
      when(repository.getFields(anyString())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
      SubjectContext adminSubject = mock(SubjectContext.class);
      when(adminSubject.isAdmin()).thenReturn(true);
      subjectMock.when(() -> SubjectContext.getSubjectContext("admin")).thenReturn(adminSubject);
      AuditReport report =
          new AuditReport()
              .withId(UUID.randomUUID())
              .withRequestedBy(
                  new EntityReference().withType("user").withFullyQualifiedName("admin"));

      // authorizeUser is the real method here: the mocked admin subject short-circuits the policy
      // evaluation, which is exactly the estate-wide behavior an admin requester gets.
      AIAssetVisibility visibility = AuditPackGenerator.requesterVisibility(report);
      assertEquals(
          2,
          visibility
              .filter(List.of(application(UUID.randomUUID()), application(UUID.randomUUID())))
              .size());
    }
  }

  private static AIApplication application(UUID id) {
    return new AIApplication().withId(id).withName("app_" + id).withFullyQualifiedName("app_" + id);
  }

  private AuditReport report(AuditReportStatus status, Long startedAt) {
    return new AuditReport().withStatus(status).withStartedAt(startedAt);
  }

  private AuditReport domainReport(UUID domainId) {
    return new AuditReport()
        .withScope(AuditReportScope.Domain)
        .withScopeTarget(new EntityReference().withId(domainId))
        .withFormat(AuditReportFormat.Json)
        .withAsOfDate(500L)
        .withIncludeRedacted(false);
  }
}
