package org.openmetadata.service.resources.entityProfiles;

import org.openmetadata.schema.api.data.CreateEntityProfile;
import org.openmetadata.schema.type.EntityProfile;
import org.openmetadata.service.mapper.EntityTimeSeriesMapper;

public class EntityProfileMapper
    implements EntityTimeSeriesMapper<EntityProfile, CreateEntityProfile> {
  @Override
  public EntityProfile createToEntity(CreateEntityProfile create, String user) {
    return copy(EntityProfile.class)
        .withTimestamp(create.getTimestamp())
        .withProfileData(create.getProfileData())
        .withProfileType(create.getProfileType());
  }
}
