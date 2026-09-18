package org.openmetadata.service.resources.dqtests;

import org.openmetadata.schema.api.tests.CreateDataQualityDimension;
import org.openmetadata.schema.tests.DataQualityDimension;
import org.openmetadata.service.mapper.EntityMapper;

public class DataQualityDimensionMapper
    implements EntityMapper<DataQualityDimension, CreateDataQualityDimension> {
  @Override
  public DataQualityDimension createToEntity(CreateDataQualityDimension create, String user) {
    return copy(new DataQualityDimension(), create, user)
        .withName(create.getName())
        .withDisplayName(create.getDisplayName())
        .withDescription(create.getDescription())
        .withStyle(create.getStyle())
        .withProvider(create.getProvider());
  }
}
