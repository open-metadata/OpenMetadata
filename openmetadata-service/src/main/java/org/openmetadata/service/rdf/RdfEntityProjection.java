package org.openmetadata.service.rdf;

import java.util.ArrayList;
import java.util.List;
import java.util.function.LongSupplier;
import java.util.function.ToLongFunction;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;
import org.openmetadata.service.rdf.storage.RdfStorageInterface.EntityWriteRequest;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;

/** Entity translation and bounded delivery shared by live writes, recovery and rebuilds. */
@Slf4j
final class RdfEntityProjection {
  private final RdfConfiguration config;
  private final RdfStorageInterface storage;
  private final JsonLdTranslator translator;
  private final ToLongFunction<RdfWriteMode> payloadBudget;
  private final LongSupplier appendBudgetOverride;

  RdfEntityProjection(
      final RdfConfiguration config,
      final RdfStorageInterface storage,
      final JsonLdTranslator translator,
      final ToLongFunction<RdfWriteMode> payloadBudget,
      final LongSupplier appendBudgetOverride) {
    this.config = config;
    this.storage = storage;
    this.translator = translator;
    this.payloadBudget = payloadBudget;
    this.appendBudgetOverride = appendBudgetOverride;
  }

  void write(final List<? extends EntityInterface<?>> entities, final RdfWriteMode writeMode) {
    final List<EntityWriteRequest> requests = translate(entities);
    if (requests.size() != entities.size()) {
      throw new IllegalStateException(
          "RDF translation failed for " + (entities.size() - requests.size()) + " entities");
    }
    store(requests, writeMode);
  }

  /** Failed translations are omitted so batch callers can attribute failures by entity ID. */
  List<EntityWriteRequest> translate(final List<? extends EntityInterface<?>> entities) {
    final List<EntityWriteRequest> requests = new ArrayList<>(entities.size());
    for (EntityInterface<?> entity : entities) {
      try {
        requests.add(
            new EntityWriteRequest(
                entity.getEntityReference().getType(), entity.getId(), translator.toRdf(entity)));
      } catch (RuntimeException failure) {
        LOG.warn("RDF translation failed for entity {}", entity.getId(), failure);
      }
    }
    return List.copyOf(requests);
  }

  void store(final List<EntityWriteRequest> requests, final RdfWriteMode writeMode) {
    final int maxCount =
        writeMode == RdfWriteMode.INSERT_ONLY
            ? RdfStorageInterface.resolveBulkAppendEntityBatchSize(config)
            : RdfRepository.resolveBulkEntityBatchSize(config);
    final long byteBudget = payloadBudget.applyAsLong(writeMode);
    final List<EntityWriteRequest> chunk = new ArrayList<>();
    long chunkBytes = 0;
    for (EntityWriteRequest request : requests) {
      final long requestBytes =
          request.model().size() * (long) RdfStorageInterface.ESTIMATED_BYTES_PER_TRIPLE;
      if (!chunk.isEmpty()
          && (chunk.size() >= maxCount || chunkBytes + requestBytes > byteBudget)) {
        storeChunk(chunk, writeMode, byteBudget);
        chunk.clear();
        chunkBytes = 0;
      }
      chunk.add(request);
      chunkBytes += requestBytes;
    }
    if (!chunk.isEmpty()) {
      storeChunk(chunk, writeMode, byteBudget);
    }
  }

  private void storeChunk(
      final List<EntityWriteRequest> chunk, final RdfWriteMode writeMode, final long byteBudget) {
    final List<EntityWriteRequest> requests = List.copyOf(chunk);
    if (appendBudgetOverride.getAsLong() > 0 && writeMode == RdfWriteMode.INSERT_ONLY) {
      storage.bulkStoreEntities(requests, writeMode, byteBudget);
    } else {
      storage.bulkStoreEntities(requests, writeMode);
    }
  }
}
