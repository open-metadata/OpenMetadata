package org.openmetadata.service.notifications.channels;

/** A notification would grow past what a chat message can carry, so it is not rendered at all. */
public class RenderBudgetExceededException extends IllegalArgumentException {

  public RenderBudgetExceededException(String message) {
    super(message);
  }
}
