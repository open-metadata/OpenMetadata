package org.openmetadata.service.apps.bundles.changeEvent;

/**
 * A consumer that reads no change events and makes its own work for the window since its previous
 * run. The kind is declared on the class, so an alert's kind is known without building its consumer.
 */
public interface SelfDrivenConsumer {}
