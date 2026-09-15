package org.openmetadata.service.entity.read;

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.entity.read.EntityPageReader.KeysetPage;
import org.openmetadata.service.entity.read.EntityPageReader.OffsetPage;
import org.openmetadata.service.entity.read.EntityPageReader.OffsetSource;
import org.openmetadata.service.entity.read.EntityPageReader.Projection;

/** Supplies page results to callers without mocking the repository's component graph. */
public record EntityPageFixture<T extends EntityInterface>(EntityPagePolicy.Query<T> forward)
    implements EntityPages<T> {
  @Override
  public ResultList<T> after(final Projection projection, final int limit, final String cursor) {
    return forward.read(projection, limit, cursor);
  }

  @Override
  public ResultList<T> before(final Projection projection, final int limit, final String cursor) {
    throw new UnsupportedOperationException();
  }

  @Override
  public ResultList<T> offset(final Projection projection, final int limit, final int offset) {
    throw new UnsupportedOperationException();
  }

  @Override
  public ResultList<T> keyset(final KeysetPage page) {
    throw new UnsupportedOperationException();
  }

  @Override
  public ResultList<T> offset(final OffsetPage page, final OffsetSource queries) {
    throw new UnsupportedOperationException();
  }
}
