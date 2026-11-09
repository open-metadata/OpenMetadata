package org.openmetadata.service.attachments;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.events.consumer.ServerStopping;

class AssetServiceFactoryTest {
  @AfterEach
  void serverIsRunningAgain() {
    ServerStopping.set(false);
  }

  /** A text read that fails on the closed client must already see the server as stopping. */
  @Test
  void theShutdownHookSignalsTheStopBeforeItClosesTheService() {
    AtomicBoolean stoppingWhenClosed = new AtomicBoolean();

    AssetServiceFactory.signalStopThenClose(() -> stoppingWhenClosed.set(ServerStopping.isSet()));

    assertTrue(stoppingWhenClosed.get());
  }
}
