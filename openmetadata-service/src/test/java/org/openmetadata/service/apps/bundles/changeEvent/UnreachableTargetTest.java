package org.openmetadata.service.apps.bundles.changeEvent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.ProcessingException;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.subscription.AlertingSettings;

/** What a tick remembers about a target it could not reach, and what it does with it. */
class UnreachableTargetTest {

  private static final String TARGET = "https://hooks.example.com/unreachable";
  private final List<String> attempts = new ArrayList<>();
  private final Destination<ChangeEvent> destination = destination();

  @AfterEach
  void endOfTick() {
    TickMemory.end();
    AlertingSettings.use(new AlertingSettings(Duration.ofSeconds(60), false));
  }

  @Test
  void secondAttemptInTheSameTickIsSkippedWhenTheSettingIsOn() {
    skipUnreachable(true);
    TickMemory.begin();

    sendFailingWith(new ProcessingException(new ConnectException("Connection refused")));
    EventPublisherException second =
        sendFailingWith(new ProcessingException(new ConnectException("Connection refused")));

    assertEquals(1, attempts.size());
    assertEquals(
        "1 of 1 recipients failed: Not attempted: unreachable earlier in this tick",
        second.getMessage());
  }

  @Test
  void nextTickTriesAgain() {
    skipUnreachable(true);
    TickMemory.begin();
    sendFailingWith(new ProcessingException(new ConnectException("Connection refused")));
    TickMemory.end();

    TickMemory.begin();
    sendFailingWith(new ProcessingException(new ConnectException("Connection refused")));

    assertEquals(2, attempts.size());
  }

  @Test
  void everyAttemptIsMadeWhileTheSettingIsOff() {
    skipUnreachable(false);
    TickMemory.begin();

    sendFailingWith(new ProcessingException(new ConnectException("Connection refused")));
    sendFailingWith(new ProcessingException(new ConnectException("Connection refused")));

    assertEquals(2, attempts.size());
  }

  @Test
  void targetThatAnsweredLateIsTriedAgain() {
    skipUnreachable(true);
    TickMemory.begin();

    sendFailingWith(new ProcessingException(new SocketTimeoutException("Read timed out")));
    sendFailingWith(new ProcessingException(new SocketTimeoutException("Read timed out")));

    assertEquals(2, attempts.size());
  }

  private EventPublisherException sendFailingWith(Exception failure) {
    return assertThrows(
        EventPublisherException.class,
        () ->
            IsolatedSends.sendToEach(
                List.of(TARGET),
                destination,
                target -> {
                  attempts.add(target);
                  throw failure;
                }));
  }

  private static void skipUnreachable(boolean skip) {
    AlertingSettings.use(new AlertingSettings(Duration.ofSeconds(60), skip));
  }

  @SuppressWarnings("unchecked")
  private static Destination<ChangeEvent> destination() {
    Destination<ChangeEvent> destination = mock(Destination.class);
    when(destination.getSubscriptionDestination()).thenReturn(new SubscriptionDestination());
    return destination;
  }
}
