package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Predicate;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jobs.BackgroundJobException;
import org.openmetadata.service.jobs.JobDAO;

class MemoryGlossaryDerivationJobHandlerTest {
  private final JobDAO jobDao = mock(JobDAO.class);
  private final List<List<ContextMemory>> derivedBatches = new ArrayList<>();

  @Test
  void aProviderWithoutADeriverFailsQueuedJobs() {
    MemoryGlossaryDerivationJobHandler handler =
        new MemoryGlossaryDerivationJobHandler(
            Optional::empty, id -> Optional.empty(), memory -> true, jobDao);

    assertThrows(BackgroundJobException.class, () -> handler.runJob(job(1L, UUID.randomUUID())));

    ArgumentCaptor<String> error = ArgumentCaptor.forClass(String.class);
    verify(jobDao)
        .failJob(eq(1L), eq("FAILED"), error.capture(), error.capture(), anyLong(), anyLong());
    assertTrue(error.getValue().contains(MemoryGlossaryDerivationJobHandler.UNAVAILABLE_MESSAGE));
  }

  @Test
  void derivesOnlyTheStoredBatchMemoriesThatAreStillEligible() throws BackgroundJobException {
    ContextMemory published = memory(MemoryVisibility.ENTITY);
    ContextMemory appended = memory(MemoryVisibility.PUBLIC);
    ContextMemory retired = memory(MemoryVisibility.ENTITY);
    retired.setEntityStatus(ContextMemoryStatus.ARCHIVED);
    ContextMemory alreadyDerived = memory(MemoryVisibility.ENTITY);
    alreadyDerived.setDerivedEntities(List.of(term()));
    UUID deleted = UUID.randomUUID();
    Map<UUID, ContextMemory> stored =
        Map.of(
            published.getId(), published,
            appended.getId(), appended,
            retired.getId(), retired,
            alreadyDerived.getId(), alreadyDerived);
    when(jobDao.fetchJobById(2L))
        .thenReturn(
            Optional.of(
                job(
                    2L,
                    published.getId(),
                    retired.getId(),
                    alreadyDerived.getId(),
                    deleted,
                    appended.getId())));
    EntityReference created = term();

    handler(stored, created).runJob(job(2L, published.getId()));

    assertEquals(List.of(List.of(published, appended)), derivedBatches);
    assertEquals(List.of(created), completedTerms(2L));
  }

  @Test
  void aBatchWithNothingLeftToDeriveSkipsTheDeriver() throws BackgroundJobException {
    ContextMemory restricted = memory(MemoryVisibility.SHARED);
    when(jobDao.fetchJobById(3L)).thenReturn(Optional.of(job(3L, restricted.getId())));

    handler(Map.of(restricted.getId(), restricted), term()).runJob(job(3L, restricted.getId()));

    assertTrue(derivedBatches.isEmpty());
    assertEquals(List.of(), completedTerms(3L));
  }

  @Test
  void aMemoryOnlySomeReadersMaySeeDefinesNoTerm() throws BackgroundJobException {
    ContextMemory orgWide = memory(MemoryVisibility.ENTITY);
    ContextMemory anchoredToAPrivateFile = memory(MemoryVisibility.ENTITY);
    when(jobDao.fetchJobById(5L))
        .thenReturn(Optional.of(job(5L, orgWide.getId(), anchoredToAPrivateFile.getId())));

    handler(
            Map.of(
                orgWide.getId(), orgWide, anchoredToAPrivateFile.getId(), anchoredToAPrivateFile),
            term(),
            memory -> memory != anchoredToAPrivateFile)
        .runJob(job(5L, orgWide.getId()));

    assertEquals(List.of(List.of(orgWide)), derivedBatches);
  }

  @Test
  void aDeriverFailureFailsTheJob() {
    ContextMemory published = memory(MemoryVisibility.ENTITY);
    when(jobDao.fetchJobById(4L)).thenReturn(Optional.of(job(4L, published.getId())));
    MemoryGlossaryDerivationJobHandler handler =
        new MemoryGlossaryDerivationJobHandler(
            () ->
                Optional.of(
                    memories -> {
                      throw new IllegalStateException("agent unavailable");
                    }),
            id -> Optional.of(published),
            memory -> true,
            jobDao);

    assertThrows(BackgroundJobException.class, () -> handler.runJob(job(4L, published.getId())));

    ArgumentCaptor<String> error = ArgumentCaptor.forClass(String.class);
    verify(jobDao)
        .failJob(eq(4L), eq("FAILED"), error.capture(), error.capture(), anyLong(), anyLong());
    assertEquals("Glossary term derivation failed: agent unavailable", error.getValue());
  }

  private MemoryGlossaryDerivationJobHandler handler(
      Map<UUID, ContextMemory> stored, EntityReference created) {
    return handler(stored, created, memory -> true);
  }

  private MemoryGlossaryDerivationJobHandler handler(
      Map<UUID, ContextMemory> stored,
      EntityReference created,
      Predicate<ContextMemory> readableByEveryone) {
    MemoryGlossaryDeriver deriver =
        memories -> {
          derivedBatches.add(memories);
          return List.of(created);
        };
    return new MemoryGlossaryDerivationJobHandler(
        () -> Optional.of(deriver),
        id -> Optional.ofNullable(stored.get(id)),
        readableByEveryone,
        jobDao);
  }

  private List<EntityReference> completedTerms(long jobId) {
    ArgumentCaptor<String> result = ArgumentCaptor.forClass(String.class);
    verify(jobDao)
        .completeJob(
            eq(jobId),
            eq("COMPLETED"),
            result.capture(),
            anyString(),
            eq(1),
            eq(1),
            anyLong(),
            anyLong());
    return JsonUtils.readValue(result.getValue(), MemoryGlossaryDerivationJobHandler.Result.class)
        .terms();
  }

  private static EntityReference term() {
    return new EntityReference().withId(UUID.randomUUID()).withType(Entity.GLOSSARY_TERM);
  }

  private static ContextMemory memory(MemoryVisibility visibility) {
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withEntityStatus(ContextMemoryStatus.APPROVED)
        .withQuestion("What is revenue churn?")
        .withAnswer("Revenue lost from existing customers over a period.")
        .withShareConfig(new MemoryShareConfig().withVisibility(visibility));
  }

  private static BackgroundJob job(long id, UUID... memoryIds) {
    return new BackgroundJob()
        .withId(id)
        .withCreatedBy("admin")
        .withJobType(BackgroundJob.JobType.MEMORY_GLOSSARY_DERIVATION)
        .withJobArgs(Map.of("memoryIds", List.of(memoryIds).stream().map(UUID::toString).toList()));
  }
}
