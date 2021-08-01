package org.openmetadata.common.module;

import java.util.Map;


/**
 * Used to define start() and stop() methods for a guice module that expects to start and stop services
 * with creation and destruction of a injector
 */
public interface StartableModule {

  /**
   * Starts up required services before tests are invoked for a test class
   *
   * @param props properties that were defined as a part of CatalogTest
   */
  void start(Map<String, Object> props);

  /**
   * Stops services that were invoked with start() after all the tests for a class
   *
   * @param props properties that were defined as a part of CatalogTest
   */
  void stop(Map<String, Object> props);
}