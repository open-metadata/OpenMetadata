/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink;

import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;

/**
 * Registry for sink providers. Allows registration of sink provider factories by sink type, and
 * creation of sink provider instances.
 *
 * <p>This is a singleton class. Use {@link #getInstance()} to access the registry.
 */
@Slf4j
public class SinkProviderRegistry {

  private static final SinkProviderRegistry INSTANCE = new SinkProviderRegistry();

  private final Map<String, SinkProviderFactory> factories = new ConcurrentHashMap<>();

  private SinkProviderRegistry() {}

  /**
   * Returns the singleton instance of the registry.
   *
   * @return the registry instance
   */
  public static SinkProviderRegistry getInstance() {
    return INSTANCE;
  }

  /**
   * Registers a sink provider factory for a given sink type.
   *
   * @param sinkType the sink type identifier (e.g., "git", "webhook")
   * @param factory the factory that creates sink provider instances
   */
  public void register(String sinkType, SinkProviderFactory factory) {
    LOG.info("Registering sink provider for type: {}", sinkType);
    factories.put(sinkType, factory);
  }

  /**
   * Unregisters a sink provider factory.
   *
   * @param sinkType the sink type to unregister
   */
  public void unregister(String sinkType) {
    LOG.info("Unregistering sink provider for type: {}", sinkType);
    factories.remove(sinkType);
  }

  /**
   * Creates a sink provider for the given sink type.
   *
   * @param sinkType the sink type identifier
   * @param config the sink configuration
   * @return an Optional containing the created sink provider, or empty if no factory is registered
   */
  public Optional<SinkProvider> create(String sinkType, Object config) {
    SinkProviderFactory factory = factories.get(sinkType);
    if (factory == null) {
      LOG.warn("No sink provider registered for type: {}", sinkType);
      return Optional.empty();
    }
    return Optional.of(factory.create(config));
  }

  /**
   * Checks if a sink provider is registered for the given type.
   *
   * @param sinkType the sink type to check
   * @return true if a provider is registered
   */
  public boolean isRegistered(String sinkType) {
    return factories.containsKey(sinkType);
  }

  /**
   * Returns the set of registered sink types.
   *
   * @return set of sink type identifiers
   */
  public Set<String> getRegisteredTypes() {
    return factories.keySet();
  }

  /** Factory interface for creating sink provider instances. */
  @FunctionalInterface
  public interface SinkProviderFactory {
    /**
     * Creates a sink provider instance with the given configuration.
     *
     * @param config the sink configuration
     * @return the created sink provider
     */
    SinkProvider create(Object config);
  }
}
