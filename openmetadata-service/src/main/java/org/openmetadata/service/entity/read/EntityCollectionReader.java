package org.openmetadata.service.entity.read;

import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

/** Materializes entity collections with the existing list and CSV hydration policies. */
public final class EntityCollectionReader<T extends EntityInterface>
    implements EntityCollections<T> {
  public record Projection(UriInfo uri, Fields fields, Include include) {}

  public record Lookup<T>(
      BiFunction<List<UUID>, Include, List<T>> ids,
      BiFunction<List<String>, Include, List<T>> names) {}

  @FunctionalInterface
  public interface FilteredHydration<T> {
    void hydrate(Fields fields, List<T> entities, ListFilter filter);
  }

  public record Hydration<T>(
      BiConsumer<Fields, List<T>> list,
      FilteredHydration<T> filtered,
      BiConsumer<Fields, List<T>> csv,
      BiFunction<UriInfo, T, T> withHref) {}

  private final Class<T> entityClass;
  private final EntityDAO<T> dao;
  private final Lookup<T> lookup;
  private final Hydration<T> hydration;

  public EntityCollectionReader(
      final EntityReadFactory.Schema<T> schema,
      final Lookup<T> lookup,
      final Hydration<T> hydration) {
    this.entityClass = schema.entityClass();
    this.dao = schema.dao();
    this.lookup = lookup;
    this.hydration = hydration;
  }

  @Override
  public List<T> byIds(final List<UUID> ids, final Projection projection) {
    final List<T> entities = lookup.ids().apply(ids, projection.include());
    try (var ignored = phase("setFieldsBulk")) {
      hydration.list().accept(projection.fields(), entities);
    }
    entities.forEach(entity -> hydration.withHref().apply(projection.uri(), entity));
    return entities;
  }

  @Override
  public List<T> byNames(final List<String> names, final Projection projection) {
    final List<T> entities = lookup.names().apply(names, projection.include());
    hydration.list().accept(projection.fields(), entities);
    entities.forEach(entity -> hydration.withHref().apply(projection.uri(), entity));
    return entities;
  }

  @Override
  public List<T> all(final Fields fields, final ListFilter filter) {
    final List<T> entities = deserialize(dao.listAfter(filter, Integer.MAX_VALUE, "", ""));
    hydration.filtered().hydrate(fields, entities, filter);
    return entities;
  }

  @Override
  public List<T> forCsv(final Fields fields, final String parentFqn) {
    final List<T> entities = deserialize(rowsUnder(parentFqn, new ListFilter(Include.NON_DELETED)));
    hydration.csv().accept(fields, entities);
    return entities;
  }

  @Override
  public List<String> rowsUnder(final String parentFqn) {
    final String hash = FullyQualifiedName.buildHash(parentFqn);
    return dao.listAll(firstChild(hash), lastChild(hash));
  }

  @Override
  public List<String> rowsUnder(final String parentFqn, final ListFilter filter) {
    final String hash = FullyQualifiedName.buildHash(parentFqn);
    return dao.listAll(firstChild(hash), lastChild(hash), filter);
  }

  private List<T> deserialize(final List<String> rows) {
    final List<T> entities = new ArrayList<>(rows.size());
    rows.forEach(row -> entities.add(JsonUtils.readValue(row, entityClass)));
    return entities;
  }

  private static String firstChild(final String hash) {
    return hash + ".00000000000000000000000000000000";
  }

  private static String lastChild(final String hash) {
    return hash + ".ffffffffffffffffffffffffffffffff";
  }
}
