package org.openmetadata.service.entity.read;

import java.util.Optional;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.entity.read.EntityReadService.Query;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/** Detail queries shared by REST, jobs, authorization and other entity consumers. */
public interface EntityReader<T extends EntityInterface> {
  T byId(UUID id, Query query);

  T byName(String name, Query query);

  default T byId(
      final UUID id, final Fields fields, final Include include, final boolean fromCache) {
    return byId(id, new Query(null, fields, RelationIncludes.fromInclude(include), fromCache));
  }

  default T byName(
      final String name, final Fields fields, final Include include, final boolean fromCache) {
    return byName(name, new Query(null, fields, RelationIncludes.fromInclude(include), fromCache));
  }

  default Optional<T> optionalByName(
      final String name, final Fields fields, final Include include, final boolean fromCache) {
    return optionalByName(
        name, new Query(null, fields, RelationIncludes.fromInclude(include), fromCache));
  }

  default Optional<T> optionalByName(final String name, final Query query) {
    try {
      return Optional.of(byName(name, query));
    } catch (EntityNotFoundException missing) {
      return Optional.empty();
    }
  }
}
