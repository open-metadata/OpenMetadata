package org.openmetadata.service.resources.apis;

import static org.openmetadata.service.util.EntityUtil.getEntityReference;
import static org.openmetadata.service.util.EntityUtil.getEntityReferences;

import org.openmetadata.schema.api.data.CreateAPICollection;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public class APICollectionMapper implements EntityMapper<APICollection, CreateAPICollection> {
  @Override
  public APICollection createToEntity(CreateAPICollection create, String user) {
    return copy(new APICollection(), create, user)
        .withService(getEntityReference(Entity.API_SERVICE, create.getService()))
        .withEndpointURL(create.getEndpointURL())
        .withApiEndpoints(getEntityReferences(Entity.API_ENDPOINT, create.getApiEndpoints()))
        .withSourceHash(create.getSourceHash());
  }
}
