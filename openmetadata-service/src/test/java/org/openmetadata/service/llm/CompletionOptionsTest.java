package org.openmetadata.service.llm;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class CompletionOptionsTest {

  @Test
  void noneReturnsAllFallbacks() {
    CompletionOptions none = CompletionOptions.NONE;
    assertEquals("default-model", none.modelIdOr("default-model"));
    assertEquals(4096, none.maxTokensOr(4096));
    assertEquals(0.0, none.temperatureOr(0.0));
    assertEquals(60, none.timeoutSecondsOr(60));
  }

  @Test
  void presentValuesOverrideFallbacks() {
    CompletionOptions opts = new CompletionOptions("nlq-model", 256, 0.2, 15);
    assertEquals("nlq-model", opts.modelIdOr("default-model"));
    assertEquals(256, opts.maxTokensOr(4096));
    assertEquals(0.2, opts.temperatureOr(0.0));
    assertEquals(15, opts.timeoutSecondsOr(60));
  }
}
