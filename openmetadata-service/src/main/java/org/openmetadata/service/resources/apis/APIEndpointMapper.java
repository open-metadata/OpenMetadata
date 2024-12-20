package org.openmetadata.service.resources.apis;

import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import org.openmetadata.schema.api.data.CreateAPIEndpoint;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public class APIEndpointMapper implements EntityMapper<APIEndpoint, CreateAPIEndpoint> {
  @Override
  public APIEndpoint createToEntity(CreateAPIEndpoint create, String user) {
    return copy(new APIEndpoint(), create, user)
        .withApiCollection(getEntityReference(Entity.API_COLLCECTION, create.getApiCollection()))
        .withRequestMethod(create.getRequestMethod())
        .withEndpointURL(create.getEndpointURL())
        .withRequestSchema(create.getRequestSchema())
        .withResponseSchema(create.getResponseSchema())
        .withSourceHash(create.getSourceHash());
  }
}
