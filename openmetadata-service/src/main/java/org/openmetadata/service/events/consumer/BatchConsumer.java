package org.openmetadata.service.events.consumer;

/**
 * A consumer that reads a batch of change events and handles the whole batch itself. The kind is
 * declared on the class, so an alert's kind is known without building its consumer.
 */
public interface BatchConsumer {}
