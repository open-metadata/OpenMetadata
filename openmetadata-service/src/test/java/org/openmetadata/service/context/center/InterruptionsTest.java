package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.channels.ClosedByInterruptException;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.llm.LLMCompletionException;

class InterruptionsTest {
  @Test
  void anInterruptedExceptionInTheCauseChainIsAnInterruption() {
    LLMCompletionException failure =
        new LLMCompletionException(
            "Knowledge pill extraction failed for 1 of 1 chunks",
            new LLMCompletionException(
                "OpenAI completion was interrupted", new InterruptedException()));

    assertTrue(Interruptions.isInterruption(failure));
  }

  /** An interrupted NIO read leaves only the thread's flag: no InterruptedException is thrown. */
  @Test
  void anInterruptedThreadIsAnInterruption() {
    LLMCompletionException failure =
        new LLMCompletionException("Bedrock completion failed", new ClosedByInterruptException());
    Thread.currentThread().interrupt();
    try {
      assertTrue(Interruptions.isInterruption(failure));
    } finally {
      Thread.interrupted();
    }
  }

  @Test
  void aFailureWithoutAnInterruptIsNotAnInterruption() {
    LLMCompletionException failure =
        new LLMCompletionException(
            "OpenAI completion failed due to IO error", new IOException("Connection reset"));

    assertFalse(Interruptions.isInterruption(failure));
  }
}
