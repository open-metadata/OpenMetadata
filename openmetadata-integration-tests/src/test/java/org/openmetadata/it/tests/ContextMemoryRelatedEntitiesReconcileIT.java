package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.UUID;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.api.data.CreateContextFile;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryScope;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ProcessingStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.test.util.RestClient;
import org.openmetadata.sdk.test.util.TestNamespace;
import org.openmetadata.sdk.test.util.TestNamespaceExtension;
import org.openmetadata.service.Entity;
import org.openmetadata.service.context.center.ContextMemoryReconciler;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;

/**
 * End-to-end regression guard for the {@code relatedEntities} null-delete hazard on a content-only
 * reconcile.
 *
 * <p>{@link ContextMemoryRepository#listExtractedMemories} hydrates only {@code
 * primaryEntity,sourceEntity}, so {@link ContextMemoryRepository#clearFields} nulls {@code
 * relatedEntities} on every pill it returns. {@link ContextMemoryReconciler#applyDerived} then
 * deep-copies that partially-fetched pill into the {@code updated} argument of {@code
 * repository.update(...)}. {@code EntityRepository.update} re-hydrates only {@code original} with
 * {@code UPDATE_FIELDS} (which includes {@code relatedEntities}), so {@code
 * ContextMemoryUpdater.entitySpecificUpdate} diffs a non-empty {@code original.relatedEntities}
 * against a null {@code updated.relatedEntities}; {@code listOrEmpty(null)} turns that into an
 * empty list, and {@code updateFromRelationships} deletes every {@code RELATED_TO} edge.
 *
 * <p>This test reproduces the exact precondition the bug report describes: a single-source,
 * APPROVED, {@code FILE_EXTRACTION} pill (the extractor's shape) carrying a {@code RELATED_TO}
 * edge added out-of-band via a REST JSON Patch that touches only {@code relatedEntities} (so
 * {@code flipToManualOnUserEdit} does not fire and the pill stays engine-managed). A
 * content-changing {@code reconcile} routes through {@code applyDerived}; the {@code RELATED_TO}
 * edge must survive.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
class ContextMemoryRelatedEntitiesReconcileIT {

  private static final String FILE_PATH = "v1/contextCenter/drive/files";
  private static final String MEMORY_PATH = "v1/contextCenter/memories";

  private ContextFile createFile(RestClient rest, String name) throws HttpResponseException {
    return rest.create(
        FILE_PATH,
        new CreateContextFile().withName(name).withProcessingStatus(ProcessingStatus.Uploaded),
        ContextFile.class);
  }

  /** Creates a pill in the extractor's exact shape: FILE_EXTRACTION, APPROVED, single source. */
  private ContextMemory createExtractedMemory(RestClient rest, String name, ContextFile file)
      throws HttpResponseException {
    EntityReference sourceRef = file.getEntityReference();
    return rest.create(
        MEMORY_PATH,
        new CreateContextMemory()
            .withName(name)
            .withTitle(name)
            .withQuestion("What does " + name + " state?")
            .withAnswer("It states " + name + ".")
            .withSourceType(ContextMemorySourceType.FILE_EXTRACTION)
            .withSourceEntity(sourceRef)
            .withPrimaryEntity(sourceRef)
            .withEntityStatus(ContextMemoryStatus.APPROVED)
            .withMemoryScope(ContextMemoryScope.ENTITY_SCOPED)
            .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY)),
        ContextMemory.class);
  }

  @ParameterizedTest
  @NullAndEmptySource
  void patchCanExplicitlyClearRelatedEntities(
      List<EntityReference> relatedEntities, TestNamespace ns) throws Exception {
    RestClient rest = RestClient.admin();
    String variant = relatedEntities == null ? "removed" : "empty";
    ContextFile source = createFile(rest, ns.prefix("patch-source-" + variant));
    ContextFile related = createFile(rest, ns.prefix("patch-related-" + variant));
    ContextMemory memory = createExtractedMemory(rest, ns.prefix("patch-pill-" + variant), source);
    ContextMemory before =
        rest.getById(
            MEMORY_PATH, memory.getId(), "relatedEntities,sourceEntity", ContextMemory.class);
    ContextMemory withRelated = JsonUtils.deepCopy(before, ContextMemory.class);
    withRelated.setRelatedEntities(List.of(related.getEntityReference()));
    rest.patch(
        MEMORY_PATH,
        memory.getId(),
        JsonUtils.pojoToJson(before),
        withRelated,
        ContextMemory.class);

    before =
        rest.getById(
            MEMORY_PATH, memory.getId(), "relatedEntities,sourceEntity", ContextMemory.class);
    assertEquals(1, before.getRelatedEntities().size());
    ContextMemory cleared = JsonUtils.deepCopy(before, ContextMemory.class);
    cleared.setRelatedEntities(relatedEntities);
    rest.patch(
        MEMORY_PATH, memory.getId(), JsonUtils.pojoToJson(before), cleared, ContextMemory.class);

    ContextMemory after =
        rest.getById(
            MEMORY_PATH, memory.getId(), "relatedEntities,sourceEntity", ContextMemory.class);
    assertTrue(
        nullOrEmpty(after.getRelatedEntities()),
        "an explicit PATCH must remove the RELATED_TO edge");
    assertEquals(source.getId(), after.getSourceEntity().getId());
  }

  @Test
  void contentReconcilePreservesRelatedEntitiesOnSingleSourceApprovedPill(TestNamespace ns)
      throws Exception {
    RestClient rest = RestClient.admin();

    ContextFile fileA = createFile(rest, ns.prefix("source-alpha"));
    ContextFile fileB = createFile(rest, ns.prefix("related-beta"));

    // 1. Create the engine-managed pill in the extractor's exact shape: single MENTIONED_IN
    //    source (fileA), no relatedEntities.
    ContextMemory memory = createExtractedMemory(rest, ns.prefix("alpha-pill"), fileA);
    UUID memoryId = memory.getId();
    ContextMemory before =
        rest.getById(MEMORY_PATH, memoryId, "relatedEntities,sourceEntity", ContextMemory.class);
    assertEquals(ContextMemorySourceType.FILE_EXTRACTION, before.getSourceType());
    assertEquals(ContextMemoryStatus.APPROVED, before.getEntityStatus());
    assertTrue(
        before.getRelatedEntities() == null || before.getRelatedEntities().isEmpty(),
        "no RELATED_TO edge before the out-of-band addition");

    // 2. Add a RELATED_TO edge to fileB via a REST JSON Patch that touches ONLY relatedEntities.
    //    extractionManagedFieldChanged() compares title/question/answer/summary/memoryType, none of
    //    which change, so flipToManualOnUserEdit() does not fire and the pill stays engine-managed
    //    (FILE_EXTRACTION + APPROVED) for the reconcile below.
    String originalJson = JsonUtils.pojoToJson(before);
    ContextMemory patched = JsonUtils.deepCopy(before, ContextMemory.class);
    patched.setRelatedEntities(List.of(fileB.getEntityReference()));
    rest.patch(MEMORY_PATH, memoryId, originalJson, patched, ContextMemory.class);

    ContextMemory afterPatch =
        rest.getById(MEMORY_PATH, memoryId, "relatedEntities,sourceEntity", ContextMemory.class);
    assertNotNull(afterPatch.getRelatedEntities(), "RELATED_TO edge must be added by the patch");
    assertEquals(1, afterPatch.getRelatedEntities().size(), "one RELATED_TO edge to fileB");
    assertEquals(fileB.getId(), afterPatch.getRelatedEntities().get(0).getId());
    assertEquals(
        ContextMemorySourceType.FILE_EXTRACTION,
        afterPatch.getSourceType(),
        "the relatedEntities-only patch must not flip sourceType to MANUAL");
    assertEquals(
        ContextMemoryStatus.APPROVED,
        afterPatch.getEntityStatus(),
        "the relatedEntities-only patch must not change the status");

    // 3. Run a content-changing reconcile as the extractor would. listExtractedMemories(A) returns
    //    the pill with relatedEntities == null (partial fetch). The re-derived pill matches by
    //    question with a CHANGED answer, so applyDerived fires: it deep-copies the partial-fetch
    //    existing into updated (relatedEntities stays null) and calls repository.update. On the
    //    unpatched code, entitySpecificUpdate diffs original.relatedEntities=[fileB] (re-hydrated
    //    from DB) against updated.relatedEntities=null -> listOrEmpty(null)=[] -> bulk-deletes the
    //    RELATED_TO edge.
    ContextMemoryRepository repo =
        (ContextMemoryRepository) Entity.getEntityRepository(Entity.CONTEXT_MEMORY);
    EntityReference sourceRef = fileA.getEntityReference();
    String revisedAnswer = "It states alpha, but the fact was revised.";
    ContextMemory derived =
        new ContextMemory()
            .withQuestion(before.getQuestion())
            .withTitle(before.getTitle())
            .withSummary(before.getSummary())
            .withMemoryType(before.getMemoryType())
            .withAnswer(revisedAnswer)
            .withSourceType(ContextMemorySourceType.FILE_EXTRACTION)
            .withMemoryScope(ContextMemoryScope.ENTITY_SCOPED)
            .withPrimaryEntity(sourceRef)
            .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY));
    ContextMemoryReconciler.ReconcileResult result =
        new ContextMemoryReconciler(repo)
            .reconcile(sourceRef, Entity.CONTEXT_FILE, List.of(derived));
    assertEquals(
        1,
        result.updated(),
        "the content-changing re-derivation should update the pill in place via applyDerived");

    // 4. The RELATED_TO edge must survive the content-only reconcile.
    ContextMemory afterReconcile =
        rest.getById(MEMORY_PATH, memoryId, "relatedEntities,sourceEntity", ContextMemory.class);
    assertNotNull(
        afterReconcile.getRelatedEntities(),
        "relatedEntities must not be nulled by a content-only reconcile");
    assertEquals(
        1,
        afterReconcile.getRelatedEntities().size(),
        "the RELATED_TO edge must survive a content-changing reconcile (null-delete bug)");
    assertEquals(
        fileB.getId(),
        afterReconcile.getRelatedEntities().get(0).getId(),
        "the surviving RELATED_TO edge must still point at fileB");
    // The content was actually applied by applyDerived.
    assertEquals(
        revisedAnswer, afterReconcile.getAnswer(), "applyDerived must have updated the answer");
    // The pill is still engine-managed (reconcile uses Operation.PUT, never flips to MANUAL).
    assertEquals(ContextMemorySourceType.FILE_EXTRACTION, afterReconcile.getSourceType());
    assertEquals(ContextMemoryStatus.APPROVED, afterReconcile.getEntityStatus());
    // The MENTIONED_IN source edge is preserved too.
    assertNotNull(afterReconcile.getSourceEntity(), "the MENTIONED_IN source edge must survive");
    assertEquals(fileA.getId(), afterReconcile.getSourceEntity().getId());
  }
}
