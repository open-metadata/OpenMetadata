package org.openmetadata.service.entity.read;

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.entity.read.EntityPageReader.KeysetPage;
import org.openmetadata.service.entity.read.EntityPageReader.OffsetPage;
import org.openmetadata.service.entity.read.EntityPageReader.OffsetSource;
import org.openmetadata.service.entity.read.EntityPageReader.Projection;

/** Entity pages with the entity family's filtering, ordering and hydration policies. */
public interface EntityPages<T extends EntityInterface> {
  ResultList<T> after(Projection projection, int limit, String after);

  ResultList<T> before(Projection projection, int limit, String before);

  ResultList<T> offset(Projection projection, int limit, int offset);

  ResultList<T> keyset(KeysetPage page);

  ResultList<T> offset(OffsetPage page, OffsetSource queries);
}
