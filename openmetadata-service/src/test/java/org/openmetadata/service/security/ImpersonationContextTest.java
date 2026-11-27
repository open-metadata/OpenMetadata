package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class ImpersonationContextTest {
  private static final String BOT = "caip-bot";

  private final ExecutorService worker = Executors.newSingleThreadExecutor();

  @AfterEach
  void tearDown() {
    ImpersonationContext.clear();
    worker.shutdownNow();
  }

  @Test
  void propagatedTaskRunsWithTheBotOfTheThreadThatSubmittedIt() throws Exception {
    ImpersonationContext.setImpersonatedBy(BOT);
    AtomicReference<String> seen = new AtomicReference<>();

    worker
        .submit(
            ImpersonationContext.propagate(
                () -> seen.set(ImpersonationContext.getImpersonatedBy())))
        .get();

    assertEquals(BOT, seen.get());
  }

  @Test
  void botIsTakenWhenTheTaskIsWrappedNotWhenItRuns() throws Exception {
    ImpersonationContext.setImpersonatedBy(BOT);
    AtomicReference<String> seen = new AtomicReference<>();
    Runnable task =
        ImpersonationContext.propagate(() -> seen.set(ImpersonationContext.getImpersonatedBy()));
    ImpersonationContext.clear();

    worker.submit(task).get();

    assertEquals(BOT, seen.get());
  }

  @Test
  void propagatedSupplierReturnsWhatItComputedWithTheSubmittersBot() throws Exception {
    ImpersonationContext.setImpersonatedBy(BOT);
    Supplier<String> task =
        ImpersonationContext.propagateResult(ImpersonationContext::getImpersonatedBy);

    String seen = worker.submit(task::get).get();

    assertEquals(BOT, seen);
    assertNull(worker.submit(ImpersonationContext::getImpersonatedBy).get());
  }

  @Test
  void runAsGivesTheTaskTheNamedBotAndNotTheCallers() throws Exception {
    ImpersonationContext.setImpersonatedBy("caller-bot");
    AtomicReference<String> seen = new AtomicReference<>();

    worker
        .submit(
            ImpersonationContext.runAs(
                BOT, () -> seen.set(ImpersonationContext.getImpersonatedBy())))
        .get();

    assertEquals(BOT, seen.get());
    assertNull(worker.submit(ImpersonationContext::getImpersonatedBy).get());
  }

  @Test
  void workerForgetsTheBotWhenThePropagatedTaskFails() throws Exception {
    ImpersonationContext.setImpersonatedBy(BOT);
    Runnable failing =
        ImpersonationContext.propagate(
            () -> {
              throw new IllegalStateException("task failed");
            });

    assertThrows(ExecutionException.class, () -> worker.submit(failing).get());

    assertNull(worker.submit(ImpersonationContext::getImpersonatedBy).get());
  }
}
