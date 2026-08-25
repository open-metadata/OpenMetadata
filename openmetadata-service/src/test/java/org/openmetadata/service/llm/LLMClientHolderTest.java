package org.openmetadata.service.llm;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;

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
}
