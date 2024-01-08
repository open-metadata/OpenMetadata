package org.openmetadata.service.events.errors;

import java.io.Serial;
import lombok.Getter;
import org.openmetadata.schema.type.ChangeEvent;

@Getter
public class EventPublisherException extends Exception {
  @Serial private static final long serialVersionUID = 1L;

  private ChangeEvent changeEvent;

  public EventPublisherException(String message, Throwable cause) {
    super(message, cause);
  }

  public EventPublisherException(String message) {
    super(message);
  }

  public EventPublisherException(String message, ChangeEvent event) {
    super(message);
    this.changeEvent = event;
  }

  public EventPublisherException(Throwable cause) {
    super(cause);
  }
}
