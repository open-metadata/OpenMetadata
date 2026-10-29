/*
 *  Copyright 2026 Collate
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
package org.openmetadata.service.rdf;

import java.time.Clock;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.api.configuration.rdf.RdfStorageMaintenanceConfig;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.ServerIdentityResolver;
import org.openmetadata.service.cluster.ClusterCapabilities;
import org.openmetadata.service.config.AsyncOperationsConfiguration;
import org.openmetadata.service.rdf.maintenance.RdfStorageMaintenanceService;
import org.openmetadata.service.rdf.rebuild.RdfWriteDelivery;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.PostCommitActionQueue;

@Slf4j
public final class RdfUpdater {
  private static volatile Consumer<RdfLiveWrite> writeQueue;
  private static RdfLiveWriter writer;
  // Set once by the application; until then storage maintenance waits, as it cannot tell
  // whether every server holds its writes back.
  private static volatile ClusterCapabilities cluster =
      capability -> Set.of("this server, whose cluster membership is not known yet");
  private static RdfStorageMaintenanceService maintenance;

  private RdfUpdater() {}

  public static void initialize(final RdfConfiguration config) {
    initialize(config, new AsyncOperationsConfiguration());
  }

  /** Tells storage maintenance which servers do not hold their writes back yet. */
  public static void useClusterCapabilities(final ClusterCapabilities capabilities) {
    cluster = capabilities;
  }

  public static synchronized void initialize(
      final RdfConfiguration config,
      final AsyncOperationsConfiguration asyncOperationsConfiguration) {
    disable();
    if (Boolean.TRUE.equals(config.getEnabled())) {
      if (asyncOperationsConfiguration.getMaxConcurrentRdfWrites() > 1) {
        LOG.warn(
            "Durable live RDF delivery uses one cluster-wide writer to preserve mutation order");
      }
      final RdfLiveWriteStore store = new RdfLiveWriteStore(Entity.getJdbi(), Clock.systemUTC());
      RdfProjectionHealth.initialize(store);
      RdfRepository.initialize(config);
      // The queue writes through its own view: a paused write is held back at once and retried,
      // and its failures stay the queue's.
      final RdfRepository repository =
          RdfRepository.getInstance().forDelivery(RdfWriteDelivery.QUEUED);
      writer =
          new RdfLiveWriter(
              store,
              command -> command.apply(repository),
              AsyncService.getInstance().getExecutorService());
      writeQueue = writer::enqueue;
      writer.start();
      startStorageMaintenance(config);
      LOG.info("RDF updater initialized with durable, ordered live writes");
    }
  }

  private static void startStorageMaintenance(final RdfConfiguration config) {
    final RdfStorageMaintenanceConfig maintenanceConfig =
        Optional.ofNullable(config.getStorageMaintenance())
            .orElseGet(RdfStorageMaintenanceConfig::new);
    if (Boolean.TRUE.equals(maintenanceConfig.getEnabled())) {
      maintenance =
          new RdfStorageMaintenanceService(
              maintenanceConfig,
              Entity.getCollectionDAO().rdfReindexLockDAO(),
              RdfRepository::getInstance,
              Clock.systemUTC(),
              ServerIdentityResolver.getInstance().getServerId(),
              capability -> cluster.serversLacking(capability));
      maintenance.start();
    } else {
      LOG.warn(
          "RDF storage maintenance is disabled: Fuseki's disk use grows until the RDF reindex"
              + " app compacts it");
    }
  }

  public static boolean isEnabled() {
    return writeQueue != null;
  }

  public static synchronized void disable() {
    stop();
    RdfRepository.reset();
  }

  public static synchronized void stop() {
    writeQueue = null;
    if (maintenance != null) {
      maintenance.close();
      maintenance = null;
    }
    if (writer != null) {
      writer.close();
      writer = null;
    }
  }

  /** Queues the PROV-O triples of one pipeline run, read back from its stored status. */
  public static void recordPipelineExecution(final UUID pipelineId, final long timestamp) {
    if (isEnabled()) {
      submit(new RdfLiveWrite.PipelineExecution(pipelineId, timestamp));
    }
  }

  public static void updateEntity(final EntityInterface entity) {
    if (isEnabled() && !RdfExcludedEntities.isExcluded(Entity.getEntityTypeFromObject(entity))) {
      submit(RdfLiveWrite.EntityUpdate.capture(entity));
    }
  }

  public static void deleteEntity(final EntityReference entity) {
    if (isEnabled() && !RdfExcludedEntities.isExcluded(entity.getType())) {
      submit(new RdfLiveWrite.EntityDelete(entity.getType(), entity.getId()));
    }
  }

  public static void addRelationship(final EntityRelationship relationship) {
    submitRelationship(relationship, false);
  }

  public static void removeRelationship(final EntityRelationship relationship) {
    submitRelationship(relationship, true);
  }

  private static void submitRelationship(
      final EntityRelationship relationship, final boolean remove) {
    if (isEnabled() && shouldIndexRelationship(relationship)) {
      submit(RdfLiveWrite.RelationshipChange.capture(relationship, remove));
    }
  }

  private static boolean shouldIndexRelationship(final EntityRelationship relationship) {
    // Typed glossary hooks own these edges; the generic hook would leak an extra om:relatedTo.
    final boolean typedGlossaryRelation =
        Entity.GLOSSARY_TERM.equals(relationship.getFromEntity())
            && Entity.GLOSSARY_TERM.equals(relationship.getToEntity())
            && relationship.getRelationshipType() == Relationship.RELATED_TO;
    return !typedGlossaryRelation
        && !RdfExcludedEntities.isExcluded(relationship.getFromEntity())
        && !RdfExcludedEntities.isExcluded(relationship.getToEntity());
  }

  public static void addGlossaryTermRelation(
      final UUID fromId, final UUID toId, final String relationType) {
    submit(new RdfLiveWrite.GlossaryRelationChange(fromId, toId, relationType, false));
  }

  public static void removeGlossaryTermRelation(
      final UUID fromId, final UUID toId, final String relationType) {
    submit(new RdfLiveWrite.GlossaryRelationChange(fromId, toId, relationType, true));
  }

  private static void submit(final RdfLiveWrite command) {
    final Consumer<RdfLiveWrite> queue = writeQueue;
    if (queue != null) {
      PostCommitActionQueue.runOrDefer(() -> queue.accept(command));
    }
  }
}
