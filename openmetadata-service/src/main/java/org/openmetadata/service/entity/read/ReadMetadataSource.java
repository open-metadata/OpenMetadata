package org.openmetadata.service.entity.read;

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Votes;

/** Supplies the requested metadata and entity-specific prefetch policies to the read pipeline. */
public interface ReadMetadataSource<T extends EntityInterface> {
  void loadTags(T entity, ReadBundle bundle);

  Votes loadVotes(T entity);

  Object loadExtension(T entity);

  void prefetch(T entity, ReadPlan plan, ReadBundle bundle);
}
