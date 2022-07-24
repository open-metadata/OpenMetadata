package org.openmetadata.catalog.security.policyevaluator;

import java.io.IOException;
import java.util.List;
import lombok.Builder;
import lombok.NonNull;
import org.openmetadata.catalog.EntityInterface;
import org.openmetadata.catalog.jdbi3.EntityRepository;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;

/** Builds ResourceContext lazily. As multiple threads don't access this, the class is not thread-safe by design. */
@Builder
public class ResourceContext implements ResourceContextInterface {
  @NonNull private String resource;
  @NonNull private EntityRepository<? extends EntityInterface> entityRepository;
  private String fields;
  private String id;
  private String name;
  private EntityInterface entity; // Will be lazily initialized

  @Override
  public EntityReference getOwner() throws IOException {
    resolveEntity();
    return entity == null ? null : entity.getOwner();
  }

  @Override
  public List<TagLabel> getTags() throws IOException {
    resolveEntity();
    return entity == null ? null : entity.getTags();
  }

  @Override
  public EntityInterface getEntity() throws IOException {
    return resolveEntity();
  }

  private EntityInterface resolveEntity() throws IOException {
    if (entity == null) {
      if (id != null) {
        entity = entityRepository.get(null, id, entityRepository.getFields(fields));
      } else if (name != null) {
        entity = entityRepository.getByName(null, name, entityRepository.getFields(fields));
      }
    }
    return entity;
  }
}
