package org.openmetadata.service.llm;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.configuration.LLMProvider;

class LLMClientHolderTest {

  @Test
  void initializesAndReturnsStableInstance() {
    LLMClientHolder.initialize(new LLMConfiguration().withProvider(LLMProvider.NOOP));
    assertNotNull(LLMClientHolder.get());
    assertSame(LLMClientHolder.get(), LLMClientHolder.get());
  }

  @Test
  void disabledConfigNeverConstructsProviderClient() {
    LLMConfiguration config =
        new LLMConfiguration().withEnabled(false).withProvider(LLMProvider.OPENAI);

    LLMClientHolder.initialize(config);

    assertFalse(LLMClientHolder.isEnabled());
    assertInstanceOf(NoopCompletionClient.class, LLMClientHolder.get());
  }

  @Test
  void memoryExtractionStaysOffWhenOnlyLlmIsEnabled() {
    // Enabling LLM features (embeddings, Ontology Studio AI) must not start deriving pills from
    // every upload and article edit: extraction carries its own switch.
    LLMClientHolder.initialize(
        new LLMConfiguration().withEnabled(true).withProvider(LLMProvider.NOOP));

    assertTrue(LLMClientHolder.isEnabled());
    assertFalse(LLMClientHolder.isMemoryExtractionEnabled());
  }

  @Test
  void memoryExtractionNeedsBothSwitches() {
    LLMClientHolder.initialize(
        new LLMConfiguration()
            .withEnabled(true)
            .withMemoryExtractionEnabled(true)
            .withProvider(LLMProvider.NOOP));
    assertTrue(LLMClientHolder.isMemoryExtractionEnabled());

    // Extraction cannot run without a usable client, whatever its own flag says.
    LLMClientHolder.initialize(
        new LLMConfiguration()
            .withEnabled(false)
            .withMemoryExtractionEnabled(true)
            .withProvider(LLMProvider.NOOP));
    assertFalse(LLMClientHolder.isMemoryExtractionEnabled());
  }
}
