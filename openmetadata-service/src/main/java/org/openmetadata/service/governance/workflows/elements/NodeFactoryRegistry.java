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

package org.openmetadata.service.governance.workflows.elements;

import java.util.Iterator;
import java.util.Map;
import java.util.Optional;
import java.util.ServiceConfigurationError;
import java.util.ServiceLoader;
import java.util.ServiceLoader.Provider;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.NodeSubType;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;

/**
 * Registry for workflow node factories. Allows Collate to register implementations for node
 * subtypes that are defined in the OpenMetadata schema but implemented only in Collate.
 *
 * <p>This is a singleton. Use {@link #getInstance()} to access it. It starts with the factories of
 * every {@link NodeFactoryProvider} on the classpath, so a process that never runs the server's
 * startup, such as {@code migrate}, still builds those nodes.
 * ADR:2026-11-18-workflow-node-factories-are-discovered-from-the-classpath
 */
@Slf4j
public class NodeFactoryRegistry {

  /**
   * Caps how many malformed registrations discovery walks past. {@code ServiceLoader}'s iterator
   * throws instead of skipping one and does not promise the next call advances.
   */
  private static final int MAX_DISCOVERY_ERRORS = 100;

  private static final NodeFactoryRegistry INSTANCE =
      discover(NodeFactoryRegistry.class.getClassLoader());

  private final Map<NodeSubType, NodeFactoryExtension> extensions = new ConcurrentHashMap<>();

  private NodeFactoryRegistry() {}

  public static NodeFactoryRegistry getInstance() {
    return INSTANCE;
  }

  /**
   * A registry holding the factories of the providers {@code classLoader} lists. A provider that
   * cannot be loaded, created or asked for its factories is logged and skipped, so one broken
   * registration never stops the built-in nodes, or the other providers, from building.
   */
  static NodeFactoryRegistry discover(final ClassLoader classLoader) {
    final NodeFactoryRegistry registry = new NodeFactoryRegistry();
    final Iterator<Provider<NodeFactoryProvider>> providers =
        ServiceLoader.load(NodeFactoryProvider.class, classLoader).stream().iterator();
    int errors = 0;
    boolean exhausted = false;
    while (!exhausted && errors < MAX_DISCOVERY_ERRORS) {
      try {
        exhausted = !providers.hasNext();
        if (!exhausted) {
          registry.registerAll(providers.next());
        }
      } catch (ServiceConfigurationError | LinkageError | RuntimeException error) {
        errors++;
        LOG.error("Skipping a workflow node factory provider that could not be loaded.", error);
      }
    }
    warnIfDiscoveryGaveUp(errors);
    return registry;
  }

  private static void warnIfDiscoveryGaveUp(final int errors) {
    if (errors >= MAX_DISCOVERY_ERRORS) {
      LOG.error(
          "Gave up discovering workflow node factory providers after {} unreadable registrations. "
              + "Any provider listed after them is not registered.",
          errors);
    }
  }

  private void registerAll(final Provider<NodeFactoryProvider> provider) {
    LOG.info("Registering workflow node factories from {}", provider.type().getName());
    provider.get().nodeFactories().forEach(this::register);
  }

  public void register(NodeSubType subType, NodeFactoryExtension extension) {
    LOG.info("Registering workflow node factory for subtype: {}", subType);
    extensions.put(subType, extension);
  }

  public void deregister(NodeSubType subType) {
    extensions.remove(subType);
  }

  public Optional<NodeInterface> create(
      NodeSubType subType,
      WorkflowNodeDefinitionInterface nodeDefinition,
      WorkflowConfiguration config,
      String workflowDefinitionName) {
    NodeFactoryExtension ext = extensions.get(subType);
    if (ext == null) {
      LOG.warn("No workflow node factory registered for subtype: {}", subType);
      return Optional.empty();
    }
    return Optional.ofNullable(ext.create(nodeDefinition, config, workflowDefinitionName));
  }

  /** Factory interface for creating {@link NodeInterface} instances. */
  @FunctionalInterface
  public interface NodeFactoryExtension {
    NodeInterface create(
        WorkflowNodeDefinitionInterface nodeDefinition,
        WorkflowConfiguration config,
        String workflowDefinitionName);
  }
}
