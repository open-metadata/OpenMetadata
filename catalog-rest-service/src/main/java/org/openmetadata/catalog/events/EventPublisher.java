package org.openmetadata.catalog.events;

import com.lmax.disruptor.EventHandler;
import com.lmax.disruptor.LifecycleAware;
import org.openmetadata.catalog.events.errors.EventPublisherException;
import org.openmetadata.catalog.resources.events.EventResource.ChangeEventList;

public interface EventPublisher extends EventHandler<EventPubSub.ChangeEventHolder>, LifecycleAware {

  void publish(ChangeEventList events) throws EventPublisherException;
}
