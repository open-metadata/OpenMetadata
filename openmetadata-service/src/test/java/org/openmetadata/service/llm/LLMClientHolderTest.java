package org.openmetadata.service.llm;

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
}
