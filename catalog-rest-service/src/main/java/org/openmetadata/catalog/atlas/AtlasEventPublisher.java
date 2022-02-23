package org.openmetadata.catalog.atlas;

import static org.reflections.Reflections.log;

import lombok.extern.slf4j.Slf4j;
import org.apache.atlas.AtlasClientV2;
import org.apache.atlas.AtlasServiceException;
import org.apache.atlas.model.instance.AtlasEntity.AtlasEntityWithExtInfo;
import org.openmetadata.catalog.events.AbstractEventPublisher;
import org.openmetadata.catalog.events.errors.EventPublisherException;
import org.openmetadata.catalog.resources.events.EventResource.ChangeEventList;

@Slf4j
public class AtlasEventPublisher extends AbstractEventPublisher {

  private final AtlasClientV2 client;

  public AtlasEventPublisher(AtlasPublisherConfiguration config) {
    super(config.getBatchSize(), config.getFilters());
    client = new AtlasClientV2(new String[] {"http://localhost:21000/"}, new String[] {"admin", "admin"});
  }

  @Override
  public void publish(ChangeEventList events) throws EventPublisherException {}

  @Override
  public void onStart() {
    try {
      AtlasEntityWithExtInfo entity = client.getEntityByGuid("9118bc85-c217-4ba8-a4e1-5b480c9f6316");
      log.info(String.valueOf(entity));
    } catch (AtlasServiceException e) {
      e.printStackTrace();
    }
  }

  @Override
  public void onShutdown() {}
}
