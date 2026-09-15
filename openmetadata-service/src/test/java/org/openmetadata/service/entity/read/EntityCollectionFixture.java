package org.openmetadata.service.entity.read;

import java.util.List;
import java.util.UUID;
import java.util.function.BiFunction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.entity.read.EntityCollectionReader.Projection;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.EntityUtil.Fields;

/** Supplies consumer query results without replacing the collection service's internal graph. */
public record EntityCollectionFixture<T extends EntityInterface>(
    BiFunction<List<UUID>, Projection, List<T>> ids, BiFunction<Fields, ListFilter, List<T>> all)
    implements EntityCollections<T> {
  @Override
  public List<T> byIds(List<UUID> ids, Projection projection) {
    return this.ids.apply(ids, projection);
  }

  @Override
  public List<T> all(Fields fields, ListFilter filter) {
    return all.apply(fields, filter);
  }

  @Override
  public List<T> byNames(List<String> names, Projection projection) {
    throw new UnsupportedOperationException("Name lookup was not supplied by this fixture");
  }

  @Override
  public List<T> forCsv(Fields fields, String parentFqn) {
    throw new UnsupportedOperationException("CSV export was not supplied by this fixture");
  }

  @Override
  public List<String> rowsUnder(String parentFqn) {
    throw new UnsupportedOperationException("Child rows were not supplied by this fixture");
  }

  @Override
  public List<String> rowsUnder(String parentFqn, ListFilter filter) {
    throw new UnsupportedOperationException("Child rows were not supplied by this fixture");
  }
}
