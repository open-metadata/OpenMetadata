package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
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
  void skipsRestrictedAndDisabledMemories() {
    ContextMemory memory = memory(UUID.randomUUID(), MemoryVisibility.SHARED);
    new OntologyMemoryDerivationQueue(jobDao, () -> true).enqueue(memory, "admin");
    memory.setShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY));
    new OntologyMemoryDerivationQueue(jobDao, () -> false).enqueue(memory, "admin");

    verifyNoInteractions(jobDao);
  }

  private static ContextMemory memory(UUID id, MemoryVisibility visibility) {
    return new ContextMemory()
        .withId(id)
        .withStatus(ContextMemoryStatus.ACTIVE)
        .withQuestion("What is revenue churn?")
        .withAnswer("Revenue lost from existing customers over a period.")
        .withShareConfig(new MemoryShareConfig().withVisibility(visibility));
  }
}
