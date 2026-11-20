package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import io.dropwizard.lifecycle.Managed;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import org.eclipse.jetty.util.component.LifeCycle;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;

class RdfDisabledMarkTest {
  private static final Duration WAIT = Duration.ofSeconds(5);
  private final RdfLiveWriteStore store = mock(RdfLiveWriteStore.class);

  @Test
  void recordsWhenThereIsNoRdfConfiguration() {
    RdfDisabledMark.recordIfDisabled(null, store);

    verify(store).recordRdfDisabled();
  }

  @Test
  void recordsWhenEnabledIsNotSet() {
    RdfDisabledMark.recordIfDisabled(new RdfConfiguration(), store);

    verify(store).recordRdfDisabled();
  }

  @Test
  void recordsWhenRdfIsDisabled() {
    RdfDisabledMark.recordIfDisabled(new RdfConfiguration().withEnabled(false), store);

    verify(store).recordRdfDisabled();
  }

  @Test
  void recordsNothingWhenRdfIsEnabled() {
    RdfDisabledMark.recordIfDisabled(new RdfConfiguration().withEnabled(true), store);

    verify(store, never()).recordRdfDisabled();
  }

  @Test
  void aServerWithRdfOffRecordsItWhenItsStopBegins() {
    final LifeCycle.Listener whenStopBegins =
        RdfDisabledMark.whenStopBegins(new RdfConfiguration().withEnabled(false), store, WAIT);

    whenStopBegins.lifeCycleStarting(null);
    whenStopBegins.lifeCycleStarted(null);
    verify(store, never()).recordRdfDisabled();

    whenStopBegins.lifeCycleStopping(null);
    verify(store).recordRdfDisabled();
  }

  @Test
  void aServerWithRdfOnRecordsNothingWhenItsStopBegins() {
    RdfDisabledMark.whenStopBegins(new RdfConfiguration().withEnabled(true), store, WAIT)
        .lifeCycleStopping(null);

    verify(store, never()).recordRdfDisabled();
  }

  @Test
  void aStoreThatDoesNotAnswerDoesNotHoldTheStop() {
    final CountDownLatch release = new CountDownLatch(1);
    doAnswer(
            invocation -> {
              release.await();
              return null;
            })
        .when(store)
        .recordRdfDisabled();
    final LifeCycle.Listener whenStopBegins =
        RdfDisabledMark.whenStopBegins(null, store, Duration.ofMillis(50));

    try {
      assertTimeoutPreemptively(WAIT, () -> whenStopBegins.lifeCycleStopping(null));
    } finally {
      release.countDown();
    }
  }

  @Test
  void anInterruptedWaitDoesNotHoldTheStopAndKeepsTheInterrupt() {
    final CountDownLatch release = new CountDownLatch(1);
    doAnswer(
            invocation -> {
              release.await();
              return null;
            })
        .when(store)
        .recordRdfDisabled();
    final LifeCycle.Listener whenStopBegins = RdfDisabledMark.whenStopBegins(null, store, WAIT);

    Thread.currentThread().interrupt();
    try {
      assertDoesNotThrow(() -> whenStopBegins.lifeCycleStopping(null));
      assertTrue(Thread.interrupted(), "the interrupt was swallowed");
    } finally {
      Thread.interrupted();
      release.countDown();
    }
  }

  @Test
  void stoppingAServerWithRdfOffRecordsItAgain() throws Exception {
    final Managed atStop = RdfDisabledMark.atStop(new RdfConfiguration().withEnabled(false), store);

    atStop.start();
    verify(store, never()).recordRdfDisabled();

    atStop.stop();
    verify(store).recordRdfDisabled();
  }

  @Test
  void stoppingAServerWithRdfOnRecordsNothing() throws Exception {
    RdfDisabledMark.atStop(new RdfConfiguration().withEnabled(true), store).stop();

    verify(store, never()).recordRdfDisabled();
  }

  @Test
  void aStoreFailureDoesNotFailShutdown() {
    doThrow(new IllegalStateException("database closed")).when(store).recordRdfDisabled();

    assertDoesNotThrow(() -> RdfDisabledMark.atStop(null, store).stop());
  }

  @Test
  void aStoreFailureDoesNotFailStartup() {
    doThrow(new IllegalStateException("database unavailable")).when(store).recordRdfDisabled();

    assertDoesNotThrow(() -> RdfDisabledMark.recordIfDisabled(null, store));
  }
}
