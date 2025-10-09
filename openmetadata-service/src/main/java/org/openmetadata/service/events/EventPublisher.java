package org.openmetadata.service.events;

import org.openmetadata.service.resources.events.EventResource.EventList;

public interface EventPublisher {

  void publish(EventList events);

  default void onStart() {
    // Default empty implementation
  }

  default void onShutdown() {
    // Default empty implementation
  }
}
