package org.openmetadata.service.entity.read;

import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.read.EntityPageReader.Projection;
import org.openmetadata.service.util.EntityUtil.Fields;
import software.amazon.awssdk.utils.Either;

/** Materializes list rows using bulk hydration, with the existing per-entity error fallback. */
@Slf4j
public final class EntityRowReader<T extends EntityInterface>
    implements EntityPageReader.Source<T> {
  public interface Hydration<T> {
    void bulk(List<T> entities, Projection projection);

    void single(T entity, Fields fields);

    void clear(T entity, Fields fields);

    T withHref(T entity, UriInfo uriInfo);
  }

  private final Class<T> entityClass;
  private final Hydration<T> hydration;
  private final Function<T, String> cursor;

  public EntityRowReader(
      final Class<T> entityClass, final Hydration<T> hydration, final Function<T, String> cursor) {
    this.entityClass = entityClass;
    this.hydration = hydration;
    this.cursor = cursor;
  }

  @Override
  public List<T> hydrate(final List<String> rows, final Projection projection) {
    final List<T> entities;
    try (var ignored = phase("jsonDeserialize")) {
      entities = JsonUtils.readObjects(rows, entityClass);
    }
    try (var ignored = phase("setFieldsBulk")) {
      hydration.bulk(entities, projection);
    }
    entities.forEach(entity -> hydration.withHref(entity, projection.uriInfo()));
    return entities;
  }

  @Override
  public Iterator<Either<T, EntityError>> deserialize(
      final List<String> rows, final Projection projection) {
    final List<Either<T, EntityError>> results = new ArrayList<>();
    final List<T> entities = new ArrayList<>(rows.size());
    rows.forEach(row -> deserialize(row, entities, results));
    if (!entities.isEmpty()) {
      hydrateRows(entities, projection, results);
    }
    return results.iterator();
  }

  @Override
  public String cursor(final T entity) {
    return cursor.apply(entity);
  }

  private void deserialize(
      final String row, final List<T> entities, final List<Either<T, EntityError>> results) {
    try {
      entities.add(JsonUtils.readValue(row, entityClass));
    } catch (RuntimeException exception) {
      results.add(
          Either.right(
              new EntityError()
                  .withMessage("Failed to deserialize entity: " + exception.getMessage())
                  .withEntity(null)));
    }
  }

  private void hydrateRows(
      final List<T> entities,
      final Projection projection,
      final List<Either<T, EntityError>> results) {
    try {
      hydration.bulk(entities, projection);
      if (projection.uriInfo() != null) {
        entities.forEach(entity -> hydration.withHref(entity, projection.uriInfo()));
      }
      entities.forEach(entity -> results.add(Either.left(entity)));
    } catch (RuntimeException exception) {
      LOG.warn("Bulk row hydration failed; falling back to per-entity loading", exception);
      entities.forEach(entity -> results.add(hydrateSingle(entity, projection)));
    }
  }

  private Either<T, EntityError> hydrateSingle(T entity, final Projection projection) {
    try {
      hydration.single(entity, projection.fields());
      if (projection.uriInfo() != null) {
        entity = hydration.withHref(entity, projection.uriInfo());
      }
      return Either.left(entity);
    } catch (RuntimeException exception) {
      hydration.clear(entity, projection.fields());
      return Either.right(new EntityError().withMessage(exception.getMessage()).withEntity(entity));
    }
  }
}
