package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jobs.JobDAO;

@ExtendWith(MockitoExtension.class)
class OntologyMemoryDerivationQueueTest {
  @Mock private JobDAO jobDao;

  @Test
  void queuesAnExtractedEntityMemory() {
    UUID memoryId = UUID.randomUUID();
    ContextMemory memory = memory(memoryId, MemoryVisibility.ENTITY);
    OntologyMemoryDerivationQueue queue = new OntologyMemoryDerivationQueue(jobDao, () -> true);

    queue.enqueue(memory, "admin");

    ArgumentCaptor<String> args = ArgumentCaptor.forClass(String.class);
    verify(jobDao)
        .enqueueOntologyMemoryDerivationJob(
            eq(List.of(memoryId.toString())), args.capture(), eq("admin"));
    OntologyMemoryDerivationJobHandler.Args payload =
        JsonUtils.readValue(args.getValue(), OntologyMemoryDerivationJobHandler.Args.class);
    assertEquals(List.of(memoryId), payload.memoryIds());
  }

  @Test
  void legacyPublishedMemoryWithoutStoredStatusIsEligible() {
    ContextMemory legacy =
        memory(UUID.randomUUID(), MemoryVisibility.ENTITY).withEntityStatus(null);

    assertTrue(OntologyMemoryDerivationQueue.isPublished(legacy));
  }

  @Test
  void batchesMemoriesExtractedFromOneSourceBehindADelay() {
    UUID memoryId = UUID.randomUUID();
    UUID fileId = UUID.randomUUID();
    ContextMemory memory =
        memory(memoryId, MemoryVisibility.ENTITY)
            .withSourceEntity(new EntityReference().withId(fileId).withType("contextFile"));
    OntologyMemoryDerivationQueue queue =
        new OntologyMemoryDerivationQueue(jobDao, () -> true, () -> 1_000L);

    queue.enqueue(memory, "admin");

    ArgumentCaptor<String> args = ArgumentCaptor.forClass(String.class);
    verify(jobDao)
        .enqueueOntologyMemoryDerivationBatch(
            eq(memoryId.toString()),
            eq("contextFile:" + fileId),
            args.capture(),
            eq("admin"),
            eq(1_000L + OntologyMemoryDerivationQueue.BATCH_WINDOW.toMillis()));
    OntologyMemoryDerivationJobHandler.Args payload =
        JsonUtils.readValue(args.getValue(), OntologyMemoryDerivationJobHandler.Args.class);
    assertEquals("contextFile:" + fileId, payload.batchKey());
    assertEquals(List.of(memoryId), payload.memoryIds());
  }

  @Test
  void neverChecksTheGateForUnpublishedMemories() {
    ContextMemory memory = memory(UUID.randomUUID(), MemoryVisibility.PRIVATE);

    new OntologyMemoryDerivationQueue(
            jobDao,
            () -> {
              throw new AssertionError("gate must not be consulted for unpublished memories");
            })
        .enqueue(memory, "admin");

    verifyNoInteractions(jobDao);
  }

  @Test
  void skipsRestrictedAndDisabledMemories() {
    ContextMemory memory = memory(UUID.randomUUID(), MemoryVisibility.SHARED);
    new OntologyMemoryDerivationQueue(jobDao, () -> true).enqueue(memory, "admin");
    memory.setShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY));
    new OntologyMemoryDerivationQueue(jobDao, () -> false).enqueue(memory, "admin");

    verifyNoInteractions(jobDao);
  }

  @Test
  void queuesWhenPublishedMemoryContentChanges() {
    UUID memoryId = UUID.randomUUID();
    ContextMemory previous = memory(memoryId, MemoryVisibility.ENTITY);
    ContextMemory updated = memory(memoryId, MemoryVisibility.ENTITY);
    updated.setAnswer("Revenue lost from existing customers during the last month.");

    assertTrue(OntologyMemoryDerivationQueue.hasNewPublishedContent(previous, updated));
  }

  @Test
  void skipsUnchangedContentAndQueuesWhenMemoryBecomesPublished() {
    UUID memoryId = UUID.randomUUID();
    ContextMemory previous = memory(memoryId, MemoryVisibility.SHARED);
    ContextMemory updated = memory(memoryId, MemoryVisibility.ENTITY);
    assertFalse(OntologyMemoryDerivationQueue.hasNewPublishedContent(updated, updated));
    assertTrue(OntologyMemoryDerivationQueue.hasNewPublishedContent(previous, updated));
  }

  private static ContextMemory memory(UUID id, MemoryVisibility visibility) {
    return new ContextMemory()
        .withId(id)
        .withEntityStatus(EntityStatus.APPROVED)
        .withQuestion("What is revenue churn?")
        .withAnswer("Revenue lost from existing customers over a period.")
        .withShareConfig(new MemoryShareConfig().withVisibility(visibility));
  }
}
