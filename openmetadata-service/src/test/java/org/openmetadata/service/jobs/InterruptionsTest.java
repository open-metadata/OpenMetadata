package org.openmetadata.service.jobs;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.channels.ClosedByInterruptException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.events.consumer.ServerStopping;
import org.openmetadata.service.llm.LLMCompletionException;

class InterruptionsTest {
  @AfterEach
  void serverIsRunningAgain() {
    ServerStopping.set(false);
  }

  @Test
  void anInterruptedExceptionInTheCauseChainIsAnInterruption() {
    LLMCompletionException failure =
        new LLMCompletionException(
            "Knowledge pill extraction failed for 1 of 1 chunks",
            new LLMCompletionException(
                "OpenAI completion was interrupted", new InterruptedException()));

    assertTrue(Interruptions.isStopInterruption(failure));
  }

  /** An interrupted NIO read leaves only the thread's flag: no InterruptedException is thrown. */
  @Test
  void anInterruptedThreadIsAnInterruption() {
    LLMCompletionException failure =
        new LLMCompletionException("Bedrock completion failed", new ClosedByInterruptException());
    Thread.currentThread().interrupt();
    try {
      assertTrue(Interruptions.isStopInterruption(failure));
    } finally {
      Thread.interrupted();
    }
  }

  /** Shutdown hooks close clients under running work, which then fails with no interrupt at all. */
  @Test
  void anyFailureWhileTheServerStopsIsAStopInterruption() {
    ServerStopping.set(true);

    assertTrue(
        Interruptions.isStopInterruption(
            new IllegalStateException("AssetService not initialized")));
  }

  @Test
  void aFailureWithoutAnInterruptIsNotAnInterruption() {
    LLMCompletionException failure =
        new LLMCompletionException(
            "OpenAI completion failed due to IO error", new IOException("Connection reset"));

    assertFalse(Interruptions.isStopInterruption(failure));
  }
}
