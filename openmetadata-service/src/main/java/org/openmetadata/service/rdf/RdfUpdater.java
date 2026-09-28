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
import java.util.UUID;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.config.AsyncOperationsConfiguration;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.PostCommitActionQueue;

@Slf4j
public final class RdfUpdater {
  private static volatile Consumer<RdfLiveWrite> writeQueue;
  private static RdfLiveWriter writer;

  private RdfUpdater() {}

  public static void initialize(final RdfConfiguration config) {
    initialize(config, new AsyncOperationsConfiguration());
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
      final RdfRepository repository = RdfRepository.getInstance();
      writer =
          new RdfLiveWriter(
              store,
              command -> command.apply(repository),
              AsyncService.getInstance().getExecutorService());
      writeQueue = writer::enqueue;
      writer.start();
      LOG.info("RDF updater initialized with durable, ordered live writes");
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
    if (writer != null) {
      writer.close();
      writer = null;
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
