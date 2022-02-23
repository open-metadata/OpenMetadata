package org.openmetadata.catalog.atlas;

import org.openmetadata.catalog.events.AbstractEventPublisher;
import org.openmetadata.catalog.events.errors.EventPublisherException;
import org.openmetadata.catalog.resources.events.EventResource.ChangeEventList;

public class AtlasEventPublisher extends AbstractEventPublisher {

  public AtlasEventPublisher(AtlasPublisherConfiguration config) {
    super(config.getBatchSize(), config.getFilters());
  }

  @Override
  public void publish(ChangeEventList events) throws EventPublisherException {}

  @Override
  public void onStart() {}

  @Override
  public void onShutdown() {}
}
