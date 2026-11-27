package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.configuration.LLMProvider;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.llm.LLMClientHolder;
import org.openmetadata.service.llm.NoopCompletionClient;

@ExtendWith(MockitoExtension.class)
class MemoryGlossaryDerivationQueueTest {
  @Mock private JobDAO jobDao;

  @AfterEach
  void resetProvider() {
    AiProviderHolder.reset();
    LLMClientHolder.initialize(null);
  }

  @Test
  void queuesAnEntityMemoryOnItsOwn() {
    UUID memoryId = UUID.randomUUID();
    ContextMemory memory = memory(memoryId, MemoryVisibility.ENTITY);

    queue(true).enqueue(memory, "admin");

    ArgumentCaptor<String> args = ArgumentCaptor.forClass(String.class);
    verify(jobDao)
        .enqueueMemoryGlossaryDerivationJob(
            eq(List.of(memoryId.toString())), args.capture(), eq("admin"));
    MemoryGlossaryDerivationJobHandler.Args payload =
        JsonUtils.readValue(args.getValue(), MemoryGlossaryDerivationJobHandler.Args.class);
    assertEquals(List.of(memoryId), payload.memoryIds());
  }

  @Test
  void batchesMemoriesExtractedFromOneSourceBehindADelay() {
    UUID memoryId = UUID.randomUUID();
    UUID fileId = UUID.randomUUID();
    ContextMemory memory =
        memory(memoryId, MemoryVisibility.PUBLIC)
            .withSourceEntity(new EntityReference().withId(fileId).withType(Entity.CONTEXT_FILE));

    queue(true).enqueue(memory, "admin");

    ArgumentCaptor<String> args = ArgumentCaptor.forClass(String.class);
    verify(jobDao)
        .enqueueMemoryGlossaryDerivationBatch(
            eq(memoryId.toString()),
            eq("contextFile:" + fileId),
            args.capture(),
            eq("admin"),
            eq(1_000L + MemoryGlossaryDerivationQueue.BATCH_WINDOW.toMillis()));
    MemoryGlossaryDerivationJobHandler.Args payload =
        JsonUtils.readValue(args.getValue(), MemoryGlossaryDerivationJobHandler.Args.class);
    assertEquals("contextFile:" + fileId, payload.batchKey());
    assertEquals(List.of(memoryId), payload.memoryIds());
  }

  @Test
  void neverAsksForADeriverForUnpublishedMemories() {
    ContextMemory memory = memory(UUID.randomUUID(), MemoryVisibility.PRIVATE);

    new MemoryGlossaryDerivationQueue(
            jobDao,
            () -> {
              throw new AssertionError("the provider must not be consulted for this memory");
            },
            () -> 0L)
        .enqueue(memory, "admin");

    verifyNoInteractions(jobDao);
  }

  @Test
  void skipsRestrictedMemoriesAndProvidersWithoutADeriver() {
    ContextMemory memory = memory(UUID.randomUUID(), MemoryVisibility.SHARED);
    queue(true).enqueue(memory, "admin");
    memory.setShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY));
    queue(false).enqueue(memory, "admin");

    verifyNoInteractions(jobDao);
  }

  @Test
  void theBuiltInProviderHasNoDeriver() {
    LLMClientHolder.setForTesting(new NoopCompletionClient());
    AiProviderHolder.setForTesting(new LlmAiProvider());

    assertFalse(MemoryGlossaryDerivationQueue.isAvailable());

    AiProviderHolder.setForTesting(providerWithDeriver());
    assertTrue(MemoryGlossaryDerivationQueue.isAvailable());
  }

  @Test
  void derivationIsOffWhileMemoryExtractionIs() {
    AiProviderHolder.setForTesting(providerWithDeriver());
    LLMClientHolder.setForTesting(null);

    assertFalse(MemoryGlossaryDerivationQueue.isAvailable());

    LLMClientHolder.setForTesting(new NoopCompletionClient());
    assertTrue(MemoryGlossaryDerivationQueue.isAvailable());
  }

  @ParameterizedTest
  @CsvSource({"false, true, false", "true, false, false", "true, true, true"})
  void bothLlmAndMemoryExtractionSwitchesGateDerivation(
      boolean llmEnabled, boolean extractionEnabled, boolean expected) {
    AiProviderHolder.setForTesting(providerWithDeriver());
    LLMClientHolder.initialize(
        new LLMConfiguration()
            .withProvider(LLMProvider.NOOP)
            .withEnabled(llmEnabled)
            .withMemoryExtractionEnabled(extractionEnabled));

    assertEquals(expected, MemoryGlossaryDerivationQueue.isAvailable());
  }

  @Test
  void queuesWhenPublishedMemoryContentChanges() {
    UUID memoryId = UUID.randomUUID();
    ContextMemory previous = memory(memoryId, MemoryVisibility.ENTITY);
    ContextMemory updated = memory(memoryId, MemoryVisibility.ENTITY);
    updated.setAnswer("Revenue lost from existing customers during the last month.");

    assertTrue(MemoryGlossaryDerivationQueue.hasNewPublishedContent(previous, updated));
  }

  @Test
  void queuesWhenPublishedMemoryTitleChanges() {
    UUID memoryId = UUID.randomUUID();
    ContextMemory previous = memory(memoryId, MemoryVisibility.PUBLIC).withTitle("Revenue churn");
    ContextMemory updated =
        memory(memoryId, MemoryVisibility.PUBLIC).withTitle("Monthly revenue churn");

    assertTrue(MemoryGlossaryDerivationQueue.hasNewPublishedContent(previous, updated));
  }

  @Test
  void skipsUnchangedContentAndQueuesWhenMemoryBecomesPublished() {
    UUID memoryId = UUID.randomUUID();
    ContextMemory previous = memory(memoryId, MemoryVisibility.SHARED);
    ContextMemory updated = memory(memoryId, MemoryVisibility.ENTITY);
    ContextMemory unapproved =
        memory(memoryId, MemoryVisibility.ENTITY).withEntityStatus(ContextMemoryStatus.DRAFT);

    assertFalse(MemoryGlossaryDerivationQueue.hasNewPublishedContent(updated, updated));
    assertTrue(MemoryGlossaryDerivationQueue.hasNewPublishedContent(previous, updated));
    assertFalse(MemoryGlossaryDerivationQueue.hasNewPublishedContent(previous, unapproved));
  }

  @Test
  void onlyADerivedGlossaryTermCountsAsAlreadyDerived() {
    EntityReference concept =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.ONTOLOGY_CONCEPT);
    EntityReference term =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.GLOSSARY_TERM);

    assertFalse(MemoryGlossaryDerivationQueue.hasDerivedGlossaryTerm(null));
    assertFalse(MemoryGlossaryDerivationQueue.hasDerivedGlossaryTerm(List.of(concept)));
    assertTrue(MemoryGlossaryDerivationQueue.hasDerivedGlossaryTerm(List.of(concept, term)));
  }

  private MemoryGlossaryDerivationQueue queue(boolean hasDeriver) {
    return new MemoryGlossaryDerivationQueue(jobDao, () -> hasDeriver, () -> 1_000L);
  }

  private static AiProvider providerWithDeriver() {
    return new AiProvider() {
      @Override
      public DocumentMemoryExtractor documentExtractor() {
        throw new AssertionError("extraction is not under test");
      }

      @Override
      public Optional<MemoryGlossaryDeriver> memoryGlossaryDeriver() {
        return Optional.of(memories -> List.of());
      }
    };
  }

  private static ContextMemory memory(UUID id, MemoryVisibility visibility) {
    return new ContextMemory()
        .withId(id)
        .withEntityStatus(ContextMemoryStatus.APPROVED)
        .withQuestion("What is revenue churn?")
        .withAnswer("Revenue lost from existing customers over a period.")
        .withShareConfig(new MemoryShareConfig().withVisibility(visibility));
  }
}
