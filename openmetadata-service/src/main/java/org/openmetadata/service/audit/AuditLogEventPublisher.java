package org.openmetadata.service.audit;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.events.AbstractEventPublisher;
import org.openmetadata.service.resources.events.EventResource;

/** Publishes change events into the persistent audit log store. */
@Slf4j
public class AuditLogEventPublisher extends AbstractEventPublisher {
  private final AuditLogRepository repository;

  public AuditLogEventPublisher(AuditLogRepository repository, int batchSize) {
    super(batchSize);
    this.repository = repository;
  }

  public AuditLogEventPublisher(AuditLogRepository repository) {
    this(repository, 100);
  }

  @Override
  public void publish(EventResource.EventList events) {
    for (ChangeEvent changeEvent : events.getData()) {
      repository.write(changeEvent);
    }
  }

  @Override
  public void onStart() {
    LOG.info("Audit log event publisher started");
  }

  @Override
  public void onShutdown() {
    LOG.info("Audit log event publisher stopped");
  }
}
