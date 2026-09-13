package org.openmetadata.service.entity;

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.entity.bulk.EntityBulkOperations;
import org.openmetadata.service.entity.bulk.EntityBulkPreparation;
import org.openmetadata.service.entity.cache.EntityCacheSource;
import org.openmetadata.service.entity.delete.EntityDeletes;
import org.openmetadata.service.entity.delete.EntityRestores;
import org.openmetadata.service.entity.delete.EntitySubtree;
import org.openmetadata.service.entity.read.EntityCollections;
import org.openmetadata.service.entity.read.EntityLookupService;
import org.openmetadata.service.entity.read.EntityPages;
import org.openmetadata.service.entity.read.EntityReader;
import org.openmetadata.service.entity.write.EntityCreates;
import org.openmetadata.service.entity.write.EntityImports;
import org.openmetadata.service.entity.write.EntityPatches;
import org.openmetadata.service.entity.write.EntityPersistence;
import org.openmetadata.service.entity.write.EntityPrepares;
import org.openmetadata.service.entity.write.EntityPuts;

/** Native application services for one registered entity family. */
public interface EntityModule<T extends EntityInterface> extends EntityCacheSource {
  String getEntityType();

  EntityFieldPolicy fieldPolicy();

  EntityLookupService<T> lookup();

  EntityReader<T> reads();

  EntityCollections<T> collections();

  EntityPages<T> pages();

  EntityPrepares<T> preparation();

  EntityBulkPreparation<T> bulkPreparation();

  EntityCreates<T> creates();

  EntityImports<T> imports();

  EntityPuts<T> puts();

  EntityPersistence<T> persistence();

  EntityPatches<T> patches();

  EntityDeletes<T> deletes();

  EntityRestores<T> restores();

  EntitySubtree subtrees();

  EntityBulkOperations<T> bulk();
}
