package org.openmetadata.service.llm;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.configuration.LLMProvider;

class LLMCompletionClientFactoryTest {

  @Test
  void noopProviderYieldsNoopClient() {
    LLMConfiguration cfg = new LLMConfiguration().withProvider(LLMProvider.NOOP);
    assertInstanceOf(NoopCompletionClient.class, LLMCompletionClientFactory.create(cfg));
  }

  @Test
  void nullConfigYieldsNoopClient() {
    assertInstanceOf(NoopCompletionClient.class, LLMCompletionClientFactory.create(null));
  }

  @Test
  void nullProviderYieldsNoopClient() {
    assertInstanceOf(
        NoopCompletionClient.class, LLMCompletionClientFactory.create(new LLMConfiguration()));
  }
}
