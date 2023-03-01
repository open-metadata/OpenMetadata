package org.openmetadata.service.resources.services.connections;

import com.google.inject.Inject;
import io.swagger.annotations.Api;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.connections.TestConnectionDefinition;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.TestConnectionDefinitionRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.EntityResource;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.RestUtil;

import javax.ws.rs.Consumes;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.UriInfo;

@Slf4j
@Path("/v1/services/testConnectionDefinition")
@Api(value = "Test Connection Definitions collection", tags = "Test Connection Definitions collection")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "TestConnectionDefinitions")
public class TestConnectionDefinitionResource extends EntityResource<TestConnectionDefinition, TestConnectionDefinitionRepository> {
  public static final String COLLECTION_PATH = "/v1/services/testConnectionDefinition";
  static final String FIELDS = "owner";
  @Override
  public TestConnectionDefinition addHref(UriInfo uriInfo, TestConnectionDefinition testConnectionDefinition) {
    testConnectionDefinition.withHref(RestUtil.getHref(uriInfo, COLLECTION_PATH, testConnectionDefinition.getId()));
    Entity.withHref(uriInfo, testConnectionDefinition.getOwner());
    return testConnectionDefinition;
  }

  @Inject
  public TestConnectionDefinitionResource(CollectionDAO dao, Authorizer authorizer) {
    super(TestConnectionDefinition.class, new TestConnectionDefinitionRepository(dao), authorizer);
  }
}
