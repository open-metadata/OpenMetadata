package org.openmetadata.service.events.errors;

import java.io.Serial;
import java.util.UUID;
import lombok.Getter;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.type.ChangeEvent;

@Getter
public class EventPublisherException extends Exception {
  @Serial private static final long serialVersionUID = 1L;

  private Pair<UUID, ChangeEvent> changeEventWithSubscription;

  public EventPublisherException(String message, Throwable cause) {
    super(message, cause);
  }

  public EventPublisherException(String message) {
    super(message);
  }

  public EventPublisherException(
      String message, Pair<UUID, ChangeEvent> failedSubscriptionChangeEvent) {
    super(message);
    this.changeEventWithSubscription = failedSubscriptionChangeEvent;
  }

  public EventPublisherException(Throwable cause) {
    super(cause);
  }
}
