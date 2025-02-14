package org.openmetadata.service.mapper;

import org.openmetadata.schema.EntityTimeSeriesInterface;

public interface EntityTimeSeriesMapper<T extends EntityTimeSeriesInterface, C> {
  T createToEntity(C create, String user);
}
