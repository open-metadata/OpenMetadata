package org.openmetadata.service.entity.read;

import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.entity.read.EntityCollectionReader.Projection;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.EntityUtil.Fields;

/** Collection queries shared by entity resources, exports and background consumers. */
public interface EntityCollections<T extends EntityInterface> {
  List<T> byIds(List<UUID> ids, Projection projection);

  List<T> byNames(List<String> names, Projection projection);

  List<T> all(Fields fields, ListFilter filter);

  List<T> forCsv(Fields fields, String parentFqn);

  List<String> rowsUnder(String parentFqn);

  List<String> rowsUnder(String parentFqn, ListFilter filter);
}
