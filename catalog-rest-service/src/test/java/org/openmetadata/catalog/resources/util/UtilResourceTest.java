package org.openmetadata.catalog.resources.util;

import static org.openmetadata.catalog.Entity.DASHBOARD;
import static org.openmetadata.catalog.Entity.TABLE;
import static org.openmetadata.catalog.Entity.TOPIC;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;

import java.io.IOException;
import java.net.URISyntaxException;
import javax.ws.rs.client.WebTarget;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.api.data.CreateDashboard;
import org.openmetadata.catalog.api.data.CreatePipeline;
import org.openmetadata.catalog.api.data.CreateTable;
import org.openmetadata.catalog.api.data.CreateTopic;
import org.openmetadata.catalog.api.services.CreateDashboardService;
import org.openmetadata.catalog.api.services.CreateDatabaseService;
import org.openmetadata.catalog.api.services.CreateMessagingService;
import org.openmetadata.catalog.api.services.CreateMlModelService;
import org.openmetadata.catalog.api.services.CreatePipelineService;
import org.openmetadata.catalog.api.teams.CreateTeam;
import org.openmetadata.catalog.api.teams.CreateUser;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.dashboards.DashboardResourceTest;
import org.openmetadata.catalog.resources.databases.TableResourceTest;
import org.openmetadata.catalog.resources.pipelines.PipelineResourceTest;
import org.openmetadata.catalog.resources.services.DashboardServiceResourceTest;
import org.openmetadata.catalog.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.catalog.resources.services.MessagingServiceResourceTest;
import org.openmetadata.catalog.resources.services.MlModelServiceResourceTest;
import org.openmetadata.catalog.resources.services.PipelineServiceResourceTest;
import org.openmetadata.catalog.resources.teams.TeamResourceTest;
import org.openmetadata.catalog.resources.teams.UserResourceTest;
import org.openmetadata.catalog.resources.topics.TopicResourceTest;
import org.openmetadata.catalog.util.EntitiesCount;
import org.openmetadata.catalog.util.ServicesCount;
import org.openmetadata.catalog.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class UtilResourceTest extends CatalogApplicationTest {

  @BeforeAll
  public static void setup(TestInfo test) throws IOException, URISyntaxException {
    EntityResourceTest<Table, CreateTable> entityResourceTest = new TableResourceTest();
    entityResourceTest.setup(test);
  }

  public static EntitiesCount getEntitiesCount() throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("util/entities/count");
    return TestUtils.get(target, EntitiesCount.class, ADMIN_AUTH_HEADERS);
  }

  public static ServicesCount getServicesCount() throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("util/services/count");
    return TestUtils.get(target, ServicesCount.class, ADMIN_AUTH_HEADERS);
  }

  public static Object getIndividualEntityCount(String entity) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("util/" + entity + "/count");
    return TestUtils.get(target, Object.class, ADMIN_AUTH_HEADERS);
  }

  @Test
  public void entitiesCount(TestInfo test) throws HttpResponseException {

    // Get count before adding entities
    int beforeTableCount = getEntitiesCount().getTableCount();
    int beforeDashboardCount = getEntitiesCount().getDashboardCount();
    int beforePipelineCount = getEntitiesCount().getPipelineCount();
    int beforeTopicCount = getEntitiesCount().getTopicCount();
    int beforeServiceCount = getEntitiesCount().getServicesCount();
    int beforeUserCount = getEntitiesCount().getUserCount();
    int beforeTeamCount = getEntitiesCount().getTeamCount();

    // Create Table
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable createTable = tableResourceTest.createRequest(test);
    tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Create Dashboard
    DashboardResourceTest dashboardResourceTest = new DashboardResourceTest();
    CreateDashboard createDashboard = dashboardResourceTest.createRequest(test);
    dashboardResourceTest.createEntity(createDashboard, ADMIN_AUTH_HEADERS);

    // Create Topic
    TopicResourceTest topicResourceTest = new TopicResourceTest();
    CreateTopic createTopic = topicResourceTest.createRequest(test);
    topicResourceTest.createEntity(createTopic, ADMIN_AUTH_HEADERS);

    // Create Pipeline
    PipelineResourceTest pipelineResourceTest = new PipelineResourceTest();
    CreatePipeline createPipeline = pipelineResourceTest.createRequest(test);
    pipelineResourceTest.createEntity(createPipeline, ADMIN_AUTH_HEADERS);

    // Create Service
    MessagingServiceResourceTest messagingServiceResourceTest = new MessagingServiceResourceTest();
    CreateMessagingService createMessagingService = messagingServiceResourceTest.createRequest(test);
    messagingServiceResourceTest.createEntity(createMessagingService, ADMIN_AUTH_HEADERS);

    // Create User
    UserResourceTest userResourceTest = new UserResourceTest();
    CreateUser createUser = userResourceTest.createRequest(test);
    userResourceTest.createEntity(createUser, ADMIN_AUTH_HEADERS);

    // Create Team
    TeamResourceTest teamResourceTest = new TeamResourceTest();
    CreateTeam createTeam = teamResourceTest.createRequest(test);
    teamResourceTest.createEntity(createTeam, ADMIN_AUTH_HEADERS);

    // Get count after adding entities
    int afterTableCount = getEntitiesCount().getTableCount();
    int afterDashboardCount = getEntitiesCount().getDashboardCount();
    int afterPipelineCount = getEntitiesCount().getPipelineCount();
    int afterTopicCount = getEntitiesCount().getTopicCount();
    int afterServiceCount = getEntitiesCount().getServicesCount();
    int afterUserCount = getEntitiesCount().getUserCount();
    int afterTeamCount = getEntitiesCount().getTeamCount();

    int actualCount = 1;

    Assertions.assertEquals(afterDashboardCount - beforeDashboardCount, actualCount);
    Assertions.assertEquals(afterPipelineCount - beforePipelineCount, actualCount);
    Assertions.assertEquals(afterServiceCount - beforeServiceCount, actualCount);
    Assertions.assertEquals(afterUserCount - beforeUserCount, actualCount);
    Assertions.assertEquals(afterTableCount - beforeTableCount, actualCount);
    Assertions.assertEquals(afterTeamCount - beforeTeamCount, actualCount);
    Assertions.assertEquals(afterTopicCount - beforeTopicCount, actualCount);
  }

  @Test
  public void servicesCount(TestInfo test) throws HttpResponseException {

    // Get count before adding services
    int beforeMessagingServiceCount = getServicesCount().getMessagingServiceCount();
    int beforeDashboardServiceCount = getServicesCount().getDashboardServiceCount();
    int beforePipelineServiceCount = getServicesCount().getPipelineServiceCounte();
    int beforeMlModelServiceCount = getServicesCount().getMlModelServiceCount();

    // Create Database Service
    DatabaseServiceResourceTest databaseServiceResourceTest = new DatabaseServiceResourceTest();
    CreateDatabaseService createDatabaseService = databaseServiceResourceTest.createRequest(test);
    databaseServiceResourceTest.createEntity(createDatabaseService, ADMIN_AUTH_HEADERS);

    // Create Messaging Service
    MessagingServiceResourceTest messagingServiceResourceTest = new MessagingServiceResourceTest();
    CreateMessagingService createMessagingService = messagingServiceResourceTest.createRequest(test);
    messagingServiceResourceTest.createEntity(createMessagingService, ADMIN_AUTH_HEADERS);

    // Create Dashboard Service
    DashboardServiceResourceTest dashboardServiceResourceTest = new DashboardServiceResourceTest();
    CreateDashboardService createDashboardService = dashboardServiceResourceTest.createRequest(test);
    dashboardServiceResourceTest.createEntity(createDashboardService, ADMIN_AUTH_HEADERS);

    // Create Pipeline Service
    PipelineServiceResourceTest pipelineServiceResourceTest = new PipelineServiceResourceTest();
    CreatePipelineService createPipelineService = pipelineServiceResourceTest.createRequest(test);
    pipelineServiceResourceTest.createEntity(createPipelineService, ADMIN_AUTH_HEADERS);

    // Create MlModel Service
    MlModelServiceResourceTest mlModelServiceResourceTest = new MlModelServiceResourceTest();
    CreateMlModelService createMlModelService = mlModelServiceResourceTest.createRequest(test);
    mlModelServiceResourceTest.createEntity(createMlModelService, ADMIN_AUTH_HEADERS);

    // Get count after creating services
    int afterMessagingServiceCount = getServicesCount().getMessagingServiceCount();
    int afterDashboardServiceCount = getServicesCount().getDashboardServiceCount();
    int afterPipelineServiceCount = getServicesCount().getPipelineServiceCounte();
    int afterMlModelServiceCount = getServicesCount().getMlModelServiceCount();
    int actualCount = 1;

    Assertions.assertEquals(afterMessagingServiceCount - beforeMessagingServiceCount, actualCount);
    Assertions.assertEquals(afterDashboardServiceCount - beforeDashboardServiceCount, actualCount);
    Assertions.assertEquals(afterPipelineServiceCount - beforePipelineServiceCount, actualCount);
    Assertions.assertEquals(afterMlModelServiceCount - beforeMlModelServiceCount, actualCount);
  }

  @Test
  public void individualEntityCount(TestInfo test) throws HttpResponseException {

    int beforeTableCount = (int) getIndividualEntityCount(TABLE);
    int beforeDashboardCount = (int) getIndividualEntityCount(DASHBOARD);
    int beforeTopicCount = (int) getIndividualEntityCount(TOPIC);

    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable createTable = tableResourceTest.createRequest(test);
    tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Create Dashboard
    DashboardResourceTest dashboardResourceTest = new DashboardResourceTest();
    CreateDashboard createDashboard = dashboardResourceTest.createRequest(test);
    dashboardResourceTest.createEntity(createDashboard, ADMIN_AUTH_HEADERS);

    // Create Topic
    TopicResourceTest topicResourceTest = new TopicResourceTest();
    CreateTopic createTopic = topicResourceTest.createRequest(test);
    topicResourceTest.createEntity(createTopic, ADMIN_AUTH_HEADERS);

    int afterTableCount = (int) getIndividualEntityCount(TABLE);
    int afterDashboardCount = (int) getIndividualEntityCount(DASHBOARD);
    int afterTopicCount = (int) getIndividualEntityCount(TOPIC);

    int actualCount = 1;

    Assertions.assertEquals(afterDashboardCount - beforeDashboardCount, actualCount);
    Assertions.assertEquals(afterTableCount - beforeTableCount, actualCount);
    Assertions.assertEquals(afterTopicCount - beforeTopicCount, actualCount);
  }
}
