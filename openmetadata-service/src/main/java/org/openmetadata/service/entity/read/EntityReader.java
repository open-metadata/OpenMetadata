package org.openmetadata.service.entity.read;

import java.util.Optional;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.entity.read.EntityReadService.Query;
import org.openmetadata.service.exception.EntityNotFoundException;

/** Detail queries shared by REST, jobs, authorization and other entity consumers. */
public interface EntityReader<T extends EntityInterface> {
  T byId(UUID id, Query query);

  T byName(String name, Query query);

  default Optional<T> optionalByName(final String name, final Query query) {
    try {
      return Optional.of(byName(name, query));
    } catch (EntityNotFoundException missing) {
      return Optional.empty();
    }
  }
}
