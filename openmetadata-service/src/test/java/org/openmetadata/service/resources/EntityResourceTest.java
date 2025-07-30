/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.resources;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.CONFLICT;
import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static jakarta.ws.rs.core.Response.Status.OK;
import static jakarta.ws.rs.core.Response.Status.PRECONDITION_FAILED;
import static java.lang.String.format;
import static java.util.Collections.emptyList;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.csv.EntityCsvTest.assertSummary;
import static org.openmetadata.schema.type.TaskType.RequestDescription;
import static org.openmetadata.service.Entity.*;
import static org.openmetadata.service.exception.CatalogExceptionMessage.ENTITY_ALREADY_EXISTS;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityIsNotEmpty;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionNotAllowed;
import static org.openmetadata.service.exception.CatalogExceptionMessage.readOnlyAttribute;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.security.SecurityUtil.getPrincipalName;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.EntityUtil.getEntityReference;
import static org.openmetadata.service.util.TestUtils.*;
import static org.openmetadata.service.util.TestUtils.UpdateType.CHANGE_CONSOLIDATED;
import static org.openmetadata.service.util.TestUtils.UpdateType.CREATED;
import static org.openmetadata.service.util.TestUtils.UpdateType.MAJOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.service.util.TestUtils.UpdateType.REVERT;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.flipkart.zjsonpatch.JsonDiff;
import es.org.elasticsearch.action.get.GetResponse;
import es.org.elasticsearch.action.search.SearchResponse;
import es.org.elasticsearch.client.Request;
import es.org.elasticsearch.client.RestClient;
import es.org.elasticsearch.search.SearchHit;
import es.org.elasticsearch.search.aggregations.Aggregation;
import es.org.elasticsearch.search.aggregations.bucket.terms.ParsedStringTerms;
import es.org.elasticsearch.search.aggregations.bucket.terms.StringTerms;
import es.org.elasticsearch.search.aggregations.metrics.ParsedTopHits;
import es.org.elasticsearch.search.aggregations.metrics.TopHitsAggregationBuilder;
import es.org.elasticsearch.xcontent.ContextParser;
import es.org.elasticsearch.xcontent.DeprecationHandler;
import es.org.elasticsearch.xcontent.NamedXContentRegistry;
import es.org.elasticsearch.xcontent.ParseField;
import es.org.elasticsearch.xcontent.XContentParser;
import es.org.elasticsearch.xcontent.json.JsonXContent;
import io.socket.client.IO;
import io.socket.client.Socket;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import java.io.IOException;
import java.net.URISyntaxException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Objects;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BiConsumer;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.Getter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.text.RandomStringGenerator;
import org.apache.commons.text.RandomStringGenerator.Builder;
import org.apache.http.client.HttpResponseException;
import org.apache.http.util.EntityUtils;
import org.awaitility.Awaitility;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.csv.CsvUtilTest;
import org.openmetadata.csv.EntityCsvTest;
import org.openmetadata.schema.CreateEntity;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.data.TermReference;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.api.feed.CreateThread;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.configuration.AssetCertificationSettings;
import org.openmetadata.schema.dataInsight.DataInsightChart;
import org.openmetadata.schema.dataInsight.type.KpiTarget;
import org.openmetadata.schema.entities.docStore.Document;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.entity.services.connections.TestConnectionResultStatus;
import org.openmetadata.schema.entity.services.connections.TestConnectionStepResult;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.entity.type.Category;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.AccessDetails;
import org.openmetadata.schema.type.AnnouncementDetails;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.LifeCycle;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.DatabaseRepository;
import org.openmetadata.service.jdbi3.DatabaseSchemaRepository;
import org.openmetadata.service.jdbi3.DatabaseServiceRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EntityRepository.EntityUpdater;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.resources.apis.APICollectionResourceTest;
import org.openmetadata.service.resources.bots.BotResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.domains.DataProductResourceTest;
import org.openmetadata.service.resources.domains.DomainResourceTest;
import org.openmetadata.service.resources.dqtests.TestCaseResourceTest;
import org.openmetadata.service.resources.dqtests.TestDefinitionResourceTest;
import org.openmetadata.service.resources.dqtests.TestSuiteResourceTest;
import org.openmetadata.service.resources.drives.WorksheetResourceTest;
import org.openmetadata.service.resources.events.EventResource.EventList;
import org.openmetadata.service.resources.events.EventSubscriptionResourceTest;
import org.openmetadata.service.resources.feeds.FeedResourceTest;
import org.openmetadata.service.resources.glossary.GlossaryResourceTest;
import org.openmetadata.service.resources.kpi.KpiResourceTest;
import org.openmetadata.service.resources.metadata.TypeResourceTest;
import org.openmetadata.service.resources.metrics.MetricResourceTest;
import org.openmetadata.service.resources.policies.PolicyResourceTest;
import org.openmetadata.service.resources.query.QueryResourceTest;
import org.openmetadata.service.resources.services.APIServiceResourceTest;
import org.openmetadata.service.resources.services.DashboardServiceResourceTest;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.service.resources.services.DriveServiceResourceTest;
import org.openmetadata.service.resources.services.MessagingServiceResourceTest;
import org.openmetadata.service.resources.services.MetadataServiceResourceTest;
import org.openmetadata.service.resources.services.MlModelServiceResourceTest;
import org.openmetadata.service.resources.services.PipelineServiceResourceTest;
import org.openmetadata.service.resources.services.SearchServiceResourceTest;
import org.openmetadata.service.resources.services.StorageServiceResourceTest;
import org.openmetadata.service.resources.tags.TagResourceTest;
import org.openmetadata.service.resources.teams.*;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.CSVExportMessage;
import org.openmetadata.service.util.CSVExportResponse;
import org.openmetadata.service.util.CSVImportMessage;
import org.openmetadata.service.util.CSVImportResponse;
import org.openmetadata.service.util.DeleteEntityMessage;
import org.openmetadata.service.util.DeleteEntityResponse;
import org.openmetadata.service.util.EntityETag;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;
import org.testcontainers.shaded.com.google.common.collect.Lists;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public abstract class EntityResourceTest<T extends EntityInterface, K extends CreateEntity>
    extends OpenMetadataApplicationTest {
  private static final Map<
          String, EntityResourceTest<? extends EntityInterface, ? extends CreateEntity>>
      ENTITY_RESOURCE_TEST_MAP = new HashMap<>();
  protected final String entityType;
  protected final Class<T> entityClass;
  private final Class<? extends ResultList<T>> entityListClass;
  protected final String collectionName;
  private final String allFields;
  private final String
      systemEntityName; // System entity provided by the system that can't be deleted
  protected final boolean supportsFollowers;
  protected final boolean supportsVotes;
  protected boolean supportsOwners;
  protected boolean supportsTags;
  protected boolean supportsPatch = true;
  protected boolean supportsEtag = true;
  protected final boolean supportsSoftDelete;
  protected boolean supportsFieldsQueryParam = true;
  protected boolean supportsPatchDomains = true;
  protected final boolean supportsEmptyDescription;
  protected boolean supportsAdminOnly = false;

  // Special characters supported in the entity name
  protected String supportedNameCharacters = "_'-.&()[]" + RANDOM_STRING_GENERATOR.generate(1);

  protected final boolean supportsCustomExtension;

  protected final boolean supportsLifeCycle;
  protected final boolean supportsDomains;
  protected final boolean supportsDataProducts;
  protected final boolean supportsExperts;
  protected final boolean supportsReviewers;
  protected final boolean supportsCertification;

  public static final String DATA_STEWARD_ROLE_NAME = "DataSteward";
  public static final String DATA_CONSUMER_ROLE_NAME = "DataConsumer";

  public static final String ENTITY_LINK_MATCH_ERROR =
      "[entityLink must match \"(?U)^<#E::\\w+::(?:[^:<>|]|:[^:<>|])+(?:::(?:[^:<>|]|:[^:<>|])+)*>$\"]";

  // Random unicode string generator to test entity name accepts all the unicode characters
  protected static final RandomStringGenerator RANDOM_STRING_GENERATOR =
      new Builder().filteredBy(Character::isLetterOrDigit).build();

  public static Domain DOMAIN;
  public static Domain SUB_DOMAIN;
  public static DataProduct DOMAIN_DATA_PRODUCT;
  public static DataProduct SUB_DOMAIN_DATA_PRODUCT;
  public static Domain DOMAIN1;

  // Users
  public static User USER_WITH_CREATE_ACCESS;
  public static User USER1;
  public static EntityReference USER1_REF;
  public static User USER2;
  public static EntityReference USER2_REF;
  public static User USER3; // User with no roles for permission testing
  public static EntityReference USER3_REF;
  public static User USER_TEAM21;
  public static User BOT_USER;
  public static EntityReference DEFAULT_BOT_ROLE_REF;
  public static EntityReference DOMAIN_ONLY_ACCESS_ROLE_REF;

  public static Team ORG_TEAM;
  public static Team TEAM1;
  public static Team TEAM11; // Team under Team1
  public static EntityReference TEAM11_REF;
  public static Team
      TEAM2; // Team 2 has team only policy and does not allow access to users not in team hierarchy
  public static Team TEAM21; // Team under Team2
  public static User DATA_STEWARD;
  public static Persona DATA_ENGINEER;
  public static Persona DATA_SCIENTIST;
  public static Document ACTIVITY_FEED_KNOWLEDGE_PANEL;
  public static Document MY_DATA_KNOWLEDGE_PANEL;
  public static User USER_WITH_DATA_STEWARD_ROLE;
  public static Role DATA_STEWARD_ROLE;
  public static EntityReference DATA_STEWARD_ROLE_REF;
  public static User DATA_CONSUMER;
  public static EntityReference DATA_CONSUMER_REF;
  public static Role DATA_CONSUMER_ROLE;
  public static EntityReference DATA_CONSUMER_ROLE_REF;
  public static Role CREATE_ACCESS_ROLE;
  public static Role ROLE1;
  public static EntityReference ROLE1_REF;
  public static Policy CREATE_ACCESS_PERMISSION_POLICY;
  public static Policy POLICY1;
  public static Policy POLICY2;
  public static Policy TEAM_ONLY_POLICY;
  public static List<Rule> TEAM_ONLY_POLICY_RULES;

  public static EntityReference SNOWFLAKE_REFERENCE;
  public static EntityReference REDSHIFT_REFERENCE;
  public static EntityReference MYSQL_REFERENCE;
  public static EntityReference BIGQUERY_REFERENCE;

  public static EntityReference KAFKA_REFERENCE;
  public static EntityReference REDPANDA_REFERENCE;
  public static EntityReference AIRFLOW_REFERENCE;
  public static EntityReference GLUE_REFERENCE;

  public static EntityReference MLFLOW_REFERENCE;

  public static EntityReference S3_OBJECT_STORE_SERVICE_REFERENCE;
  public static EntityReference ELASTICSEARCH_SEARCH_SERVICE_REFERENCE;
  public static EntityReference OPENSEARCH_SEARCH_SERVICE_REFERENCE;

  public static EntityReference OPENMETADATA_API_SERVICE_REFERENCE;
  public static EntityReference SAMPLE_API_SERVICE_REFERENCE;
  public static EntityReference OPENMETADATA_API_COLLECTION_REFERENCE;
  public static EntityReference SAMPLE_API_COLLECTION_REFERENCE;
  public static EntityReference AMUNDSEN_SERVICE_REFERENCE;
  public static EntityReference ATLAS_SERVICE_REFERENCE;

  public static EntityReference GOOGLE_DRIVE_SERVICE_REFERENCE;
  public static EntityReference SHAREPOINT_DRIVE_SERVICE_REFERENCE;

  public static Classification USER_CLASSIFICATION;
  public static Tag ADDRESS_TAG;
  public static TagLabel USER_ADDRESS_TAG_LABEL;
  public static TagLabel PERSONAL_DATA_TAG_LABEL;
  public static TagLabel PII_SENSITIVE_TAG_LABEL;
  public static TagLabel TIER1_TAG_LABEL;
  public static TagLabel TIER2_TAG_LABEL;

  public static Glossary GLOSSARY1;
  public static Glossary GLOSSARY2;

  public static Metric Metric1;
  public static Metric Metric2;

  public static GlossaryTerm GLOSSARY1_TERM1;
  public static TagLabel GLOSSARY1_TERM1_LABEL;

  public static GlossaryTerm GLOSSARY2_TERM1;
  public static TagLabel GLOSSARY2_TERM1_LABEL;

  public static EntityReference METABASE_REFERENCE;
  public static EntityReference LOOKER_REFERENCE;
  public static List<String> CHART_REFERENCES;
  public static List<String> DASHBOARD_REFERENCES;

  public static Database DATABASE;
  public static DatabaseSchema DATABASE_SCHEMA;

  public static Table TEST_TABLE1;
  public static Table TEST_TABLE2;

  public static TestSuite TEST_SUITE1;
  public static Table TEST_SUITE_TABLE1;
  public static CreateTestSuite CREATE_TEST_SUITE1;

  public static TestSuite TEST_SUITE2;
  public static Table TEST_SUITE_TABLE2;
  public static CreateTestSuite CREATE_TEST_SUITE2;
  public static TestDefinition TEST_DEFINITION1;
  public static TestDefinition TEST_DEFINITION2;
  public static TestDefinition TEST_DEFINITION3;
  public static TestDefinition TEST_DEFINITION4;
  public static TestDefinition TEST_DEFINITION5;

  public static DataInsightChart DI_CHART1;

  public static KpiTarget KPI_TARGET;

  public static final String C1 = "c'_+# 1";
  public static final String C2 = "c2()$";
  public static final String C3 = "\"c.3\"";
  public static final String C4 = "\"c.4\"";
  public static List<Column> COLUMNS;

  public static final TestConnectionResult TEST_CONNECTION_RESULT =
      new TestConnectionResult()
          .withStatus(TestConnectionResultStatus.SUCCESSFUL)
          .withSteps(
              List.of(
                  new TestConnectionStepResult()
                      .withMandatory(true)
                      .withName("myStep")
                      .withMessage("All good")
                      .withPassed(true)));

  public static Type INT_TYPE;
  public static Type STRING_TYPE;
  public static Type EMAIL_TYPE;
  public static Type DATECP_TYPE;
  public static Type DATETIMECP_TYPE;
  public static Type TIMECP_TYPE;
  public static Type DURATION_TYPE;
  public static Type MARKDOWN_TYPE;
  public static Type ENTITY_REFERENCE_TYPE;
  public static Type ENTITY_REFERENCE_LIST_TYPE;
  public static Type TIME_INTERVAL_TYPE;
  public static Type NUMBER_TYPE;
  public static Type SQLQUERY_TYPE;
  public static Type TIMESTAMP_TYPE;

  public static Type ENUM_TYPE;
  public static Type TABLE_TYPE;

  // Run webhook related tests randomly. This will ensure these tests are not run for every entity
  // evey time junit tests are run to save time. But over the course of development of a release,
  // when tests are run enough times, the webhook tests are run for all the entities.
  private static final int RUN_WEBHOOK_TEST = 0;
  private static final int RUN_SLACK_TEST = 1;
  private static final int RUN_MS_TEAMS_TEST = 2;
  public static boolean EVENT_SUBSCRIPTION_TEST_CONTROL_FLAG = true;
  private static final int SELECTED_TEST_CATEGORY = new Random().nextInt(3);

  protected boolean supportsSearchIndex = false;

  public EntityResourceTest(
      String entityType,
      Class<T> entityClass,
      Class<? extends ResultList<T>> entityListClass,
      String collectionName,
      String fields) {
    this(entityType, entityClass, entityListClass, collectionName, fields, null);
  }

  public EntityResourceTest(
      String entityType,
      Class<T> entityClass,
      Class<? extends ResultList<T>> entityListClass,
      String collectionName,
      String fields,
      String systemEntityName) {
    this.entityType = entityType;
    this.entityClass = entityClass;
    this.entityListClass = entityListClass;
    this.collectionName = collectionName;
    this.allFields = fields;
    ENTITY_RESOURCE_TEST_MAP.put(entityType, this);
    Set<String> allowedFields = Entity.getEntityFields(entityClass);
    this.supportsEmptyDescription = !EntityUtil.isDescriptionRequired(entityClass);
    this.supportsFollowers = allowedFields.contains(FIELD_FOLLOWERS);
    this.supportsVotes = allowedFields.contains(FIELD_VOTES);
    this.supportsOwners = allowedFields.contains(FIELD_OWNERS);
    this.supportsTags = allowedFields.contains(FIELD_TAGS);
    this.supportsSoftDelete = allowedFields.contains(FIELD_DELETED);
    this.supportsCustomExtension = allowedFields.contains(FIELD_EXTENSION);
    this.supportsLifeCycle = allowedFields.contains(FIELD_LIFE_CYCLE);
    this.systemEntityName = systemEntityName;
    this.supportsDomains = allowedFields.contains(Entity.FIELD_DOMAINS);
    this.supportsDataProducts = allowedFields.contains(FIELD_DATA_PRODUCTS);
    this.supportsExperts = allowedFields.contains(FIELD_EXPERTS);
    this.supportsReviewers = allowedFields.contains(FIELD_REVIEWERS);
    this.supportsCertification = allowedFields.contains(FIELD_CERTIFICATION);
  }

  @BeforeAll
  public void setup(TestInfo test) throws URISyntaxException, IOException {
    new PolicyResourceTest().setupPolicies();
    new RoleResourceTest().setupRoles(test);
    new PersonaResourceTest().setupPersonas(test);
    new TeamResourceTest().setupTeams(test);
    new UserResourceTest().setupUsers(test);
    new DomainResourceTest().setupDomains(test);
    new DataProductResourceTest().setupDataProducts(test);

    new TagResourceTest().setupTags();
    new GlossaryResourceTest().setupGlossaries();
    new MetricResourceTest().setupMetrics();

    new DatabaseServiceResourceTest().setupDatabaseServices(test);
    new MessagingServiceResourceTest().setupMessagingServices();
    new PipelineServiceResourceTest().setupPipelineServices(test);
    new DashboardServiceResourceTest().setupDashboardServices(test);
    new MlModelServiceResourceTest().setupMlModelServices(test);
    new StorageServiceResourceTest().setupStorageService(test);
    new SearchServiceResourceTest().setupSearchService(test);
    new APIServiceResourceTest().setupAPIService(test);
    new MetadataServiceResourceTest().setupMetadataServices();
    new DriveServiceResourceTest().setupDriveServices(test);
    new TableResourceTest().setupDatabaseSchemas(test);
    new TestSuiteResourceTest().setupTestSuites(test);
    new TestDefinitionResourceTest().setupTestDefinitions();
    new TestCaseResourceTest().setupTestCase(test);
    new TypeResourceTest().setupTypes();
    new KpiResourceTest().setupKpi();
    new BotResourceTest().setupBots();
    new QueryResourceTest().setupQuery(test);
    new APICollectionResourceTest().setupAPICollection(test);
    new WorksheetResourceTest().setupSpreadsheet(test);

    if (EVENT_SUBSCRIPTION_TEST_CONTROL_FLAG) {
      switch (SELECTED_TEST_CATEGORY) {
        case RUN_WEBHOOK_TEST -> {
          webhookCallbackResource.clearEvents();
          EventSubscriptionResourceTest webhookTest = new EventSubscriptionResourceTest();
          webhookTest.startWebhookSubscription();
          webhookTest.startWebhookEntitySubscriptions(entityType);
        }
        case RUN_SLACK_TEST -> {
          slackCallbackResource.clearEvents();
          EventSubscriptionResourceTest slackTest = new EventSubscriptionResourceTest();
          slackTest.startSlackSubscription();
          slackTest.startSlackEntitySubscriptions(entityType);
        }
        case RUN_MS_TEAMS_TEST -> {
          teamsCallbackResource.clearEvents();
          EventSubscriptionResourceTest msTeamsTest = new EventSubscriptionResourceTest();
          msTeamsTest.startMSTeamsSubscription();
          msTeamsTest.startMSTeamsEntitySubscription(entityType);
        }
      }
    }
  }

  @AfterAll
  public void afterAllTests() throws Exception {
    if (EVENT_SUBSCRIPTION_TEST_CONTROL_FLAG) {
      switch (SELECTED_TEST_CATEGORY) {
        case RUN_WEBHOOK_TEST -> {
          EventSubscriptionResourceTest webhookTest = new EventSubscriptionResourceTest();
          webhookTest.validateWebhookEvents();
          webhookTest.validateWebhookEntityEvents(entityType);
        }
        case RUN_SLACK_TEST -> {
          EventSubscriptionResourceTest slackTest = new EventSubscriptionResourceTest();
          slackTest.validateSlackEvents();
          slackTest.validateSlackEntityEvents(entityType);
        }
        case RUN_MS_TEAMS_TEST -> {
          EventSubscriptionResourceTest msTeamsTest = new EventSubscriptionResourceTest();
          msTeamsTest.validateMSTeamsEvents();
          msTeamsTest.validateMSTeamsEntityEvents(entityType);
        }
      }
    }
    delete_recursiveTest();
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////
  // Methods to be overridden entity test class
  //////////////////////////////////////////////////////////////////////////////////////////////////

  // Create request such as CreateTable, CreateChart returned by concrete implementation
  public final K createRequest(TestInfo test) {
    K createRequest = createRequest(getEntityName(test)).withDescription("").withDisplayName(null);
    createRequest.setOwners(emptyList());
    return createRequest;
  }

  public final K createRequest(TestInfo test, int index) {
    return createRequest(getEntityName(test, index)).withDescription("").withDisplayName(null);
  }

  public K createRequest(
      String name, String description, String displayName, List<EntityReference> owners) {
    if (!supportsEmptyDescription && description == null) {
      throw new IllegalArgumentException(
          "Entity " + entityType + " does not support empty description");
    }
    K createRequest = createRequest(name).withDescription(description).withDisplayName(displayName);
    createRequest.setOwners(reduceEntityReferences(owners));
    return createRequest;
  }

  public abstract K createRequest(String name);

  // Get container entity used in createRequest that has CONTAINS relationship to the entity created
  // with this request has. For table, it is database. For database, it is databaseService. See
  // Relationship.CONTAINS for details.
  public EntityReference getContainer() {
    return null;
  }

  // Get container entity based on create request that has CONTAINS relationship to the entity
  // created with this request has. For table, it is database. For database, it is databaseService.
  // See Relationship.CONTAINS for details.
  public EntityReference getContainer(T e) {
    return null;
  }

  // Entity specific validate for entity create using POST
  public abstract void validateCreatedEntity(
      T createdEntity, K request, Map<String, String> authHeaders) throws HttpResponseException;

  // Entity specific validate for entity created using PUT
  public void validateUpdatedEntity(
      T updatedEntity, K request, Map<String, String> authHeaders, UpdateType updateType)
      throws HttpResponseException {
    if (updateType == NO_CHANGE) {
      // Check updated entity only when a change is made
      assertListNotNull(
          updatedEntity.getId(), updatedEntity.getHref(), updatedEntity.getFullyQualifiedName());
      return;
    }
    validateCommonEntityFields(updatedEntity, request, getPrincipalName(authHeaders));
    validateCreatedEntity(updatedEntity, request, authHeaders);
  }

  protected void validateDeletedEntity(
      K create, T entityBeforeDeletion, T entityAfterDeletion, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(entityAfterDeletion, create, getPrincipalName(authHeaders));
    validateCreatedEntity(entityAfterDeletion, create, authHeaders);
  }

  // Entity specific validate for entity create using PATCH
  public abstract void compareEntities(T expected, T updated, Map<String, String> authHeaders)
      throws HttpResponseException;

  protected void compareChangeEventsEntities(T expected, T updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    compareEntities(expected, updated, authHeaders);
  }

  /**
   * GET by id and GET by name with different `fields` parameter and ensure the requested fields are returned. Common
   * fields for all entities - `owner`, `followers`, and `tags` need not be tested by implementations as it is done
   * already in the base class.
   */
  public abstract T validateGetWithDifferentFields(T entity, boolean byName)
      throws HttpResponseException;

  // Assert field change in an entity recorded during PUT or POST operations
  public abstract void assertFieldChange(String fieldName, Object expected, Object actual)
      throws IOException;

  //////////////////////////////////////////////////////////////////////////////////////////////////
  // Common entity tests for GET operations
  //////////////////////////////////////////////////////////////////////////////////////////////////
  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void get_entityWithDifferentFieldsQueryParam(TestInfo test) throws HttpResponseException {
    if (!supportsFieldsQueryParam) {
      return;
    }

    T entity = createEntity(createRequest(test, 0), ADMIN_AUTH_HEADERS);

    String allFields = getAllowedFields();

    // GET an entity by ID with all the field names of an entity should be successful
    getEntity(entity.getId(), allFields, ADMIN_AUTH_HEADERS);

    // GET an entity by name with all the field names of an entity should be successful
    getEntityByName(entity.getFullyQualifiedName(), allFields, ADMIN_AUTH_HEADERS);

    // GET list of entities with all the field names of an entity should be successful
    Map<String, String> params = new HashMap<>();
    params.put("fields", allFields);
    listEntities(params, ADMIN_AUTH_HEADERS);

    // Requesting invalid fields should result in an error
    String invalidField = "invalidField";
    assertResponse(
        () -> getEntity(entity.getId(), invalidField, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.invalidField(invalidField));

    assertResponse(
        () -> getEntityByName(entity.getFullyQualifiedName(), invalidField, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.invalidField(invalidField));

    params.put("fields", invalidField);
    assertResponse(
        () -> listEntities(params, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Invalid field name invalidField");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void test_bulkLoadingEfficiency(TestInfo test) throws HttpResponseException {
    if (!supportsFieldsQueryParam) {
      return;
    }

    // Create multiple entities to test bulk loading
    int entityCount = Math.min(50, 10); // Create 10 entities for testing, or fewer if constrained
    List<T> entities = new ArrayList<>();

    for (int i = 0; i < entityCount; i++) {
      K createRequest = createRequest(test, i);
      T entity = createEntity(createRequest, ADMIN_AUTH_HEADERS);
      entities.add(entity);
    }

    String allFields = getAllowedFields();
    Map<String, String> params = new HashMap<>();
    params.put("fields", allFields);

    // Test 1: Verify that listing entities with all fields works correctly
    ResultList<T> result = listEntities(params, ADMIN_AUTH_HEADERS);
    assertNotNull(result, "Bulk listing should return results");
    assertTrue(
        result.getData().size() >= entityCount, "Should return at least the created entities");

    // Test 2: Test bulk loading performance by measuring time
    long startTime = System.currentTimeMillis();
    ResultList<T> bulkResult = listEntities(params, ADMIN_AUTH_HEADERS);
    long bulkTime = System.currentTimeMillis() - startTime;

    // Test 3: Compare with individual entity loading time
    startTime = System.currentTimeMillis();
    for (T entity : entities) {
      getEntity(entity.getId(), allFields, ADMIN_AUTH_HEADERS);
    }
    long individualTime = System.currentTimeMillis() - startTime;

    LOG.info("Bulk loading time: {}ms, Individual loading time: {}ms", bulkTime, individualTime);

    // Test 4: Verify that bulk loaded entities have the same field completeness
    if (!bulkResult.getData().isEmpty()) {
      T bulkEntity = bulkResult.getData().get(0);
      T individualEntity = getEntity(bulkEntity.getId(), allFields, ADMIN_AUTH_HEADERS);

      // Verify critical fields are populated in bulk load
      assertEquals(
          bulkEntity.getId(),
          individualEntity.getId(),
          "Entity ID should match between bulk and individual load");
      assertEquals(
          bulkEntity.getFullyQualifiedName(),
          individualEntity.getFullyQualifiedName(),
          "FQN should match between bulk and individual load");

      // If the entity supports specific fields, verify they are loaded
      if (supportsTags && bulkEntity.getTags() != null) {
        assertEquals(
            bulkEntity.getTags().size(),
            individualEntity.getTags().size(),
            "Tags should be loaded consistently in bulk operations");
      }

      if (supportsOwners && bulkEntity.getOwners() != null) {
        assertEquals(
            bulkEntity.getOwners().size(),
            individualEntity.getOwners().size(),
            "Owners should be loaded consistently in bulk operations");
      }
    }

    // Test 5: Verify that bulk loading doesn't cause N+1 query issues by testing with larger
    // datasets
    // This is more of a monitoring test - in production, bulk loading should be significantly
    // faster
    if (entityCount >= 5) {
      assertTrue(
          bulkTime <= individualTime * 2,
          "Bulk loading should not be significantly slower than individual loading. "
              + "Bulk: "
              + bulkTime
              + "ms, Individual: "
              + individualTime
              + "ms");
    }

    // Clean up created entities
    for (T entity : entities) {
      deleteEntity(entity.getId(), ADMIN_AUTH_HEADERS);
    }
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void test_fieldFetchersEfficiency(TestInfo test) throws HttpResponseException {
    if (!supportsFieldsQueryParam) {
      return;
    }

    // Create entities to test field fetching patterns
    int entityCount = 20;
    List<T> entities = new ArrayList<>();

    for (int i = 0; i < entityCount; i++) {
      K createRequest = createRequest(test, i);
      T entity = createEntity(createRequest, ADMIN_AUTH_HEADERS);
      entities.add(entity);
    }

    // Test bulk field fetching with different field combinations
    // Build combinations based on what the entity actually supports
    List<String> fieldCombinationsList = new ArrayList<>();

    // Add combinations based on supported fields
    if (supportsOwners && supportsTags) {
      fieldCombinationsList.add("owners,tags");
    } else if (supportsOwners) {
      fieldCombinationsList.add("owners");
    }

    if (supportsFollowers && supportsOwners) {
      fieldCombinationsList.add("followers,owners");
    } else if (supportsFollowers) {
      fieldCombinationsList.add("followers");
    }

    // Build a combination with domain, tags, and owners if supported
    StringBuilder complexFields = new StringBuilder();
    if (supportsDomains) {
      complexFields.append("domains");
    }
    if (supportsTags) {
      if (complexFields.length() > 0) complexFields.append(",");
      complexFields.append("tags");
    }
    if (supportsOwners) {
      if (complexFields.length() > 0) complexFields.append(",");
      complexFields.append("owners");
    }
    if (complexFields.length() > 0) {
      fieldCombinationsList.add(complexFields.toString());
    }

    // Always test with all allowed fields
    fieldCombinationsList.add(getAllowedFields());

    String[] fieldCombinations = fieldCombinationsList.toArray(new String[0]);

    for (String fields : fieldCombinations) {
      if (fields == null || fields.isEmpty()) continue;

      Map<String, String> params = new HashMap<>();
      params.put("fields", fields);

      // Test bulk loading with specific field combinations
      long startTime = System.currentTimeMillis();
      ResultList<T> bulkResult = listEntities(params, ADMIN_AUTH_HEADERS);
      long bulkTime = System.currentTimeMillis() - startTime;

      // Verify that the requested fields are populated in bulk results
      if (!bulkResult.getData().isEmpty()) {
        T entity = bulkResult.getData().get(0);

        // Test that bulk loading populates the same fields as individual loading
        T individualEntity = getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);

        // Verify field consistency between bulk and individual loading
        if (fields.contains("owners") && supportsOwners) {
          assertEquals(
              listOrEmpty(entity.getOwners()).size(),
              listOrEmpty(individualEntity.getOwners()).size(),
              "Owners field should be consistently loaded in bulk operations for fields: "
                  + fields);
        }

        if (fields.contains("tags") && supportsTags) {
          assertEquals(
              listOrEmpty(entity.getTags()).size(),
              listOrEmpty(individualEntity.getTags()).size(),
              "Tags field should be consistently loaded in bulk operations for fields: " + fields);
        }

        if (fields.contains("followers") && supportsFollowers) {
          // Get the actual followers from both bulk and individual loading
          List<EntityReference> bulkFollowers = entity.getFollowers();
          List<EntityReference> individualFollowers = individualEntity.getFollowers();

          // The test should verify that followers are actually fetched and populated
          // Previously this might have passed because both were null/empty due to missing field
          // support
          assertEquals(
              listOrEmpty(bulkFollowers).size(),
              listOrEmpty(individualFollowers).size(),
              "Followers field should be consistently loaded in bulk operations for fields: "
                  + fields);

          // Add verification that if followers exist, they have proper entity references
          if (!listOrEmpty(bulkFollowers).isEmpty()) {
            for (EntityReference follower : bulkFollowers) {
              assertNotNull(follower.getId(), "Follower should have valid ID");
              assertNotNull(follower.getName(), "Follower should have valid name");
              assertNotNull(follower.getType(), "Follower should have valid type");
            }
          }

          // Verify that the followers data matches between bulk and individual fetch
          if (!listOrEmpty(bulkFollowers).isEmpty()
              && !listOrEmpty(individualFollowers).isEmpty()) {
            assertEquals(
                bulkFollowers,
                individualFollowers,
                "Followers data should be identical between bulk and individual loading");
          }
        }
      }

      LOG.info(
          "Field fetching test for '{}' completed in {}ms with {} entities",
          fields,
          bulkTime,
          bulkResult.getData().size());
    }

    // Clean up created entities
    for (T entity : entities) {
      deleteEntity(entity.getId(), ADMIN_AUTH_HEADERS);
    }
  }

  @Test
  @Order(1)
  @Execution(ExecutionMode.CONCURRENT)
  void test_bulkFollowersVotesFetching_alwaysFirstName(TestInfo test) throws IOException {
    // Use a name that always lands first alphabetically.
    // Note: The special character "\!A_" is prefixed to ensure the entity sorts before others.
    // This allows us to verify ordering without listing all 100 entities.
    String alwaysFirstName = "!A_AlwaysFirstEntity";
    K request = createRequest(alwaysFirstName);
    T entity = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Add a follower if supported.
    if (supportsFollowers) {
      addFollower(entity.getId(), USER1.getId(), OK, ADMIN_AUTH_HEADERS);
    }

    // Vote up the entity if supported.
    if (supportsVotes) {
      VoteRequest voteReq = new VoteRequest().withUpdatedVoteType(VoteRequest.VoteType.VOTED_UP);
      WebTarget voteTarget = getResource(entity.getId()).path("vote");
      TestUtils.put(voteTarget, voteReq, ChangeEvent.class, OK, ADMIN_AUTH_HEADERS);
    }

    // Bulk fetch of entities with all allowed fields.
    String allFields = getAllowedFields();
    Map<String, String> params = new HashMap<>();
    params.put("fields", allFields);
    ResultList<T> bulk = listEntities(params, ADMIN_AUTH_HEADERS);

    // Verify that the created entity is present in the bulk results.
    T bulkEntity =
        bulk.getData().stream()
            .filter(e -> e.getId().equals(entity.getId()))
            .findFirst()
            .orElse(null);
    assertNotNull(bulkEntity);

    // Fetch the individual entity to compare details.
    T individual = getEntity(entity.getId(), allFields, ADMIN_AUTH_HEADERS);

    // Ensure follower counts match for both bulk and individual fetches.
    if (supportsFollowers) {
      assertNotNull(bulkEntity.getFollowers());
      assertEquals(
          listOrEmpty(individual.getFollowers()).size(),
          listOrEmpty(bulkEntity.getFollowers()).size());
    }

    // Ensure vote counts match for bulk and individual fetching.
    if (supportsVotes) {
      assertNotNull(bulkEntity.getVotes());
      assertEquals(individual.getVotes().getUpVotes(), bulkEntity.getVotes().getUpVotes());
      assertEquals(individual.getVotes().getDownVotes(), bulkEntity.getVotes().getDownVotes());
    }

    // Clean up the created test entity.
    deleteEntity(entity.getId(), ADMIN_AUTH_HEADERS);
  }

  // Helper method to get field value using reflection
  private Object getField(T entity, String fieldName) {
    try {
      // Try common getter patterns
      java.lang.reflect.Method getter = null;
      try {
        getter = entity.getClass().getMethod("get" + capitalize(fieldName));
      } catch (NoSuchMethodException e) {
        // Try is* pattern for boolean fields
        try {
          getter = entity.getClass().getMethod("is" + capitalize(fieldName));
        } catch (NoSuchMethodException e2) {
          return null;
        }
      }
      return getter.invoke(entity);
    } catch (Exception e) {
      return null;
    }
  }

  private String capitalize(String str) {
    if (str == null || str.isEmpty()) return str;
    return str.substring(0, 1).toUpperCase() + str.substring(1);
  }

  @Test
  void patchWrongDomainId(TestInfo test) throws IOException {
    Assumptions.assumeTrue(supportsDomains);
    T entity = createEntity(createRequest(test, 0), ADMIN_AUTH_HEADERS);
    // Data Product domain cannot be modified see DataProductRepository.restorePatchAttributes
    Assumptions.assumeTrue(!(entity.getEntityReference().getType().equals(DATA_PRODUCT)));

    // Add random domain reference
    EntityReference domainReference =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.DOMAIN);
    String originalJson = JsonUtils.pojoToJson(entity);
    ChangeDescription change = getChangeDescription(entity, MINOR_UPDATE);
    // Test with a single domain reference
    entity.setDomains(List.of(domainReference));

    assertResponse(
        () -> patchEntityAndCheck(entity, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change),
        NOT_FOUND,
        String.format("domain instance for %s not found", domainReference.getId()));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void patchWrongDataProducts(TestInfo test) throws IOException {
    Assumptions.assumeTrue(supportsDataProducts);
    T entity = createEntity(createRequest(test, 0), ADMIN_AUTH_HEADERS);

    // Add random domain reference
    EntityReference dataProductReference = new EntityReference().withId(UUID.randomUUID());
    String originalJson = JsonUtils.pojoToJson(entity);
    ChangeDescription change = getChangeDescription(entity, MINOR_UPDATE);
    entity.setDataProducts(List.of(dataProductReference));

    assertResponse(
        () -> patchEntityAndCheck(entity, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change),
        NOT_FOUND,
        String.format("dataProduct instance for %s not found", dataProductReference.getId()));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void patch_dataProducts_200_ok(TestInfo test) throws IOException {
    Assumptions.assumeTrue(supportsDataProducts);
    Assumptions.assumeTrue(supportsDomains);

    // Create entity without dataProducts
    T entity = createEntity(createRequest(test, 0), ADMIN_AUTH_HEADERS);

    // First add a domain (required for dataProducts)
    DomainResourceTest domainResourceTest = new DomainResourceTest();
    Domain domain =
        domainResourceTest.createEntity(domainResourceTest.createRequest(test), ADMIN_AUTH_HEADERS);
    EntityReference domainRef = domain.getEntityReference();

    String originalJson = JsonUtils.pojoToJson(entity);
    entity.setDomains(List.of(domainRef));
    ChangeDescription change = getChangeDescription(entity, MINOR_UPDATE);
    fieldAdded(change, FIELD_DOMAINS, List.of(domainRef));
    entity = patchEntityAndCheck(entity, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Create a data product
    DataProductResourceTest dataProductResourceTest = new DataProductResourceTest();
    CreateDataProduct createDataProduct =
        dataProductResourceTest
            .createRequest(test)
            .withDomains(listOf(domainRef.getFullyQualifiedName()));
    DataProduct dataProduct =
        dataProductResourceTest.createEntity(createDataProduct, ADMIN_AUTH_HEADERS);
    EntityReference dataProductRef = dataProduct.getEntityReference();

    // Add dataProduct to entity via PATCH
    originalJson = JsonUtils.pojoToJson(entity);
    entity.setDataProducts(List.of(dataProductRef));
    change = getChangeDescription(entity, MINOR_UPDATE);
    fieldAdded(change, FIELD_DATA_PRODUCTS, List.of(dataProductRef));
    T patchedEntity =
        patchEntityAndCheck(entity, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Verify the patch response contains the dataProducts
    assertNotNull(patchedEntity.getDataProducts(), "Patch response should include dataProducts");
    assertEquals(
        1, patchedEntity.getDataProducts().size(), "Patch response should have 1 dataProduct");
    assertEquals(
        dataProductRef.getId(),
        patchedEntity.getDataProducts().getFirst().getId(),
        "Patch response should contain the correct dataProduct ID");

    // Also verify by fetching the entity with dataProducts field
    T fetchedEntity = getEntity(entity.getId(), FIELD_DATA_PRODUCTS, ADMIN_AUTH_HEADERS);
    assertNotNull(fetchedEntity.getDataProducts(), "Fetched entity should have dataProducts");
    assertEquals(
        1, fetchedEntity.getDataProducts().size(), "Fetched entity should have 1 dataProduct");
    assertEquals(
        dataProductRef.getId(),
        fetchedEntity.getDataProducts().getFirst().getId(),
        "Fetched entity should have the correct dataProduct");

    // Test the bug scenario - patch with different dataProducts and verify response
    // The bug was that patch response showed empty dataProducts even though they were created
    CreateDataProduct createDataProduct2 =
        dataProductResourceTest
            .createRequest(test, 1)
            .withDomains(listOf(domainRef.getFullyQualifiedName()));
    DataProduct dataProduct2 =
        dataProductResourceTest.createEntity(createDataProduct2, ADMIN_AUTH_HEADERS);
    EntityReference dataProductRef2 = dataProduct2.getEntityReference();

    // Replace dataProducts with a new one
    originalJson = JsonUtils.pojoToJson(patchedEntity);
    patchedEntity.setDataProducts(List.of(dataProductRef2));
    change = getChangeDescription(patchedEntity, MINOR_UPDATE);
    fieldAdded(change, FIELD_DATA_PRODUCTS, List.of(dataProductRef2));
    fieldDeleted(change, FIELD_DATA_PRODUCTS, List.of(dataProductRef));
    T replacedPatch =
        patchEntityAndCheck(patchedEntity, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // This is where the bug would be caught - verify patch response contains the dataProducts
    assertNotNull(replacedPatch.getDataProducts(), "Patch response should include dataProducts");
    assertFalse(
        replacedPatch.getDataProducts().isEmpty(),
        "Patch response should NOT have empty dataProducts - this was the bug!");
    assertEquals(1, replacedPatch.getDataProducts().size(), "Should have 1 dataProduct");
    assertEquals(
        dataProductRef2.getId(),
        replacedPatch.getDataProducts().get(0).getId(),
        "Should have the new dataProduct");

    // Clean up: Remove dataProducts from entity before domain deletion to avoid validation errors
    originalJson = JsonUtils.pojoToJson(replacedPatch);
    replacedPatch.setDataProducts(null);
    change = getChangeDescription(replacedPatch, MINOR_UPDATE);
    fieldDeleted(change, FIELD_DATA_PRODUCTS, List.of(dataProductRef2));
    replacedPatch =
        patchEntityAndCheck(replacedPatch, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Remove domain from entity
    originalJson = JsonUtils.pojoToJson(replacedPatch);
    replacedPatch.setDomains(null);
    change = getChangeDescription(replacedPatch, MINOR_UPDATE);
    fieldDeleted(change, FIELD_DOMAINS, List.of(domainRef));
    patchEntityAndCheck(replacedPatch, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Now safely delete the dataProducts and domain
    dataProductResourceTest.deleteEntity(dataProduct.getId(), ADMIN_AUTH_HEADERS);
    dataProductResourceTest.deleteEntity(dataProduct2.getId(), ADMIN_AUTH_HEADERS);
    domainResourceTest.deleteEntity(domain.getId(), ADMIN_AUTH_HEADERS);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void patch_relationshipFields_consolidation_200_ok(TestInfo test) throws IOException {
    // This test verifies that all relationship fields are properly returned in patch responses
    // during session consolidation (multiple patches within session timeout)

    if (!supportsPatch || !supportsFieldsQueryParam) {
      return;
    }

    // Create base entity
    T entity = createEntity(createRequest(test, 0), ADMIN_AUTH_HEADERS);

    // Test 1: Add domain (if supported)
    if (supportsDomains && supportsPatchDomains) {
      DomainResourceTest domainResourceTest = new DomainResourceTest();
      Domain domain =
          domainResourceTest.createEntity(
              domainResourceTest.createRequest(test), ADMIN_AUTH_HEADERS);

      String originalJson = JsonUtils.pojoToJson(entity);
      entity.setDomains(List.of(domain.getEntityReference()));
      ChangeDescription change = getChangeDescription(entity, MINOR_UPDATE);
      fieldAdded(change, FIELD_DOMAINS, List.of(domain.getEntityReference()));
      T patchedEntity =
          patchEntityAndCheck(entity, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

      // Verify domain is in patch response
      assertNotNull(patchedEntity.getDomains(), "Patch response should include domains");
      assertEquals(1, patchedEntity.getDomains().size(), "Should have 1 domain");
      entity = patchedEntity;
    }

    // Test 2: Add owner within session timeout (tests consolidation)
    // Only check if we are adding owners from scratch, not updating existing ones
    if (supportsOwners && nullOrEmpty(entity.getOwners())) {
      String originalJson = JsonUtils.pojoToJson(entity);
      entity.setOwners(List.of(USER1_REF));
      ChangeDescription change = getChangeDescription(entity, getChangeType());
      fieldAdded(change, FIELD_OWNERS, List.of(USER1_REF));
      T patchedEntity =
          patchEntityAndCheck(entity, originalJson, ADMIN_AUTH_HEADERS, getChangeType(), change);

      // Verify owner is in patch response
      assertNotNull(patchedEntity.getOwners(), "Patch response should include owners");
      assertEquals(1, patchedEntity.getOwners().size(), "Should have 1 owner");
      assertEquals(
          USER1_REF.getId(), patchedEntity.getOwners().get(0).getId(), "Should have correct owner");
      entity = patchedEntity;
    }

    // Test 3: Add reviewers within session timeout (if supported)
    // Only check if we are adding reviewers from scratch, not updating existing ones
    if (supportsReviewers && nullOrEmpty(entity.getReviewers())) {
      String originalJson = JsonUtils.pojoToJson(entity);
      entity.setReviewers(List.of(USER2_REF));
      ChangeDescription change = getChangeDescription(entity, getChangeType());
      fieldAdded(change, FIELD_REVIEWERS, List.of(USER2_REF));
      T patchedEntity =
          patchEntityAndCheck(entity, originalJson, ADMIN_AUTH_HEADERS, getChangeType(), change);

      // Verify reviewers is in patch response
      assertNotNull(patchedEntity.getReviewers(), "Patch response should include reviewers");
      assertEquals(1, patchedEntity.getReviewers().size(), "Should have 1 reviewer");
      entity = patchedEntity;
    }

    // Test 4: Add experts within session timeout (if supported)
    // Only check if we are adding experts from scratch, not updating existing ones
    if (supportsExperts && nullOrEmpty(entity.getExperts())) {
      String originalJson = JsonUtils.pojoToJson(entity);
      entity.setExperts(List.of(DATA_STEWARD.getEntityReference()));
      ChangeDescription change = getChangeDescription(entity, getChangeType());
      fieldAdded(change, FIELD_EXPERTS, List.of(DATA_STEWARD.getEntityReference()));
      T patchedEntity =
          patchEntityAndCheck(entity, originalJson, ADMIN_AUTH_HEADERS, getChangeType(), change);

      // Verify experts is in patch response
      assertNotNull(patchedEntity.getExperts(), "Patch response should include experts");
      assertEquals(1, patchedEntity.getExperts().size(), "Should have 1 expert");
      entity = patchedEntity;
    }

    // Final verification: Fetch entity with all fields and compare
    String fields =
        Stream.of(
                supportsOwners ? FIELD_OWNERS : null,
                supportsDomains ? FIELD_DOMAINS : null,
                supportsReviewers ? FIELD_REVIEWERS : null,
                supportsExperts ? FIELD_EXPERTS : null,
                supportsDataProducts ? FIELD_DATA_PRODUCTS : null)
            .filter(Objects::nonNull)
            .collect(Collectors.joining(","));

    if (!fields.isEmpty()) {
      T fetchedEntity = getEntity(entity.getId(), fields, ADMIN_AUTH_HEADERS);

      // Verify all relationship fields match
      if (supportsOwners && entity.getOwners() != null) {
        assertEntityReferences(entity.getOwners(), fetchedEntity.getOwners());
      }
      if (supportsDomains && entity.getDomains() != null) {
        assertEntityReferences(entity.getDomains(), fetchedEntity.getDomains());
      }
      if (supportsReviewers && entity.getReviewers() != null) {
        assertEntityReferences(entity.getReviewers(), fetchedEntity.getReviewers());
      }
      if (supportsExperts && entity.getExperts() != null) {
        assertEntityReferences(entity.getExperts(), fetchedEntity.getExperts());
      }
    }
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  protected void get_entityListWithPagination_200(TestInfo test) throws IOException {
    //    if (test.getTestClass().isPresent()) {
    //      if (test.getTestClass().get().getSimpleName().equals("GlossaryTermResourceTest")) {
    //        WorkflowHandler.getInstance().suspendWorkflow("GlossaryTermApprovalWorkflow");
    //      }
    //    }
    // Create a number of entities between 5 and 20 inclusive
    Random rand = new Random();
    int maxEntities = rand.nextInt(16) + 5;

    List<UUID> createdUUIDs = new ArrayList<>();
    for (int i = 0; i < maxEntities; i++) {
      createdUUIDs.add(createEntity(createRequest(test, i + 1), ADMIN_AUTH_HEADERS).getId());
    }
    T entity = createEntity(createRequest(test, 0), ADMIN_AUTH_HEADERS);
    deleteAndCheckEntity(entity, ADMIN_AUTH_HEADERS);

    Predicate<T> matchDeleted = e -> e.getId().equals(entity.getId());

    // Test listing entities that include deleted, non-deleted, and all the entities
    Random random = new Random();
    for (Include include : List.of(Include.NON_DELETED, Include.ALL, Include.DELETED)) {
      if (!supportsSoftDelete && include.equals(Include.DELETED)) {
        continue;
      }
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("include", include.value());

      // List all entities and use it for checking pagination
      ResultList<T> allEntities =
          listEntities(queryParams, 1000000, null, null, ADMIN_AUTH_HEADERS);
      int totalRecords = allEntities.getData().size();
      printEntities(allEntities);

      // List entity with "limit" set from 1 to maxEntities size with random jumps (to reduce the
      // test time) Each time compare the returned list with allTables list to make sure right
      // results are returned
      for (int limit = 1; limit < maxEntities; limit += random.nextInt(5) + 1) {
        String after = null;
        String before;
        int pageCount = 0;
        int indexInAllTables = 0;
        ResultList<T> forwardPage;
        ResultList<T> backwardPage;
        boolean foundDeleted = false;
        do { // For each limit (or page size) - forward scroll till the end
          LOG.debug(
              "Limit {} forward pageCount {} indexInAllTables {} totalRecords {} afterCursor {}",
              limit,
              pageCount,
              indexInAllTables,
              totalRecords,
              after);
          forwardPage = listEntities(queryParams, limit, null, after, ADMIN_AUTH_HEADERS);
          foundDeleted = forwardPage.getData().stream().anyMatch(matchDeleted) || foundDeleted;
          after = forwardPage.getPaging().getAfter();
          before = forwardPage.getPaging().getBefore();
          assertEntityPagination(allEntities.getData(), forwardPage, limit, indexInAllTables);

          if (pageCount == 0) { // CASE 0 - First page is being returned. There is no before-cursor
            assertNull(before);
          } else {
            // Make sure scrolling back based on before cursor returns the correct result
            backwardPage = listEntities(queryParams, limit, before, null, ADMIN_AUTH_HEADERS);
            assertEntityPagination(
                allEntities.getData(), backwardPage, limit, (indexInAllTables - limit));
          }

          printEntities(forwardPage);
          indexInAllTables += forwardPage.getData().size();
          pageCount++;
        } while (after != null);

        boolean includeAllOrDeleted =
            Include.ALL.equals(include) || Include.DELETED.equals(include);
        if (includeAllOrDeleted) {
          assertTrue(!supportsSoftDelete || foundDeleted);
        } else { // non-delete
          assertFalse(foundDeleted);
        }

        // We have now reached the last page - test backward scroll till the beginning
        pageCount = 0;
        indexInAllTables = totalRecords - limit - forwardPage.getData().size();
        foundDeleted = false;
        do {
          LOG.debug(
              "Limit {} backward pageCount {} indexInAllTables {} totalRecords {} afterCursor {}",
              limit,
              pageCount,
              indexInAllTables,
              totalRecords,
              after);
          forwardPage = listEntities(queryParams, limit, before, null, ADMIN_AUTH_HEADERS);
          foundDeleted = forwardPage.getData().stream().anyMatch(matchDeleted) || foundDeleted;
          printEntities(forwardPage);
          before = forwardPage.getPaging().getBefore();
          assertEntityPagination(allEntities.getData(), forwardPage, limit, indexInAllTables);
          pageCount++;
          indexInAllTables -= forwardPage.getData().size();
        } while (before != null);

        if (includeAllOrDeleted) {
          assertTrue(!supportsSoftDelete || foundDeleted);
        } else { // non-delete
          assertFalse(foundDeleted);
        }
      }

      // before running "deleted" delete all created entries otherwise the test doesn't work with
      // just one element.
      if (Include.ALL.equals(include)) {
        for (T toBeDeleted : allEntities.getData()) {
          if (createdUUIDs.contains(toBeDeleted.getId())
              && Boolean.FALSE.equals(toBeDeleted.getDeleted())) {
            deleteAndCheckEntity(toBeDeleted, ADMIN_AUTH_HEADERS);
          }
        }
      }
    }

    //    if (test.getTestClass().isPresent()) {
    //      if (test.getTestClass().get().getSimpleName().equals("GlossaryTermResourceTest")) {
    //        WorkflowHandler.getInstance().resumeWorkflow("GlossaryTermApprovalWorkflow");
    //      }
    //    }
  }

  protected void validateEntityListFromSearchWithPagination(
      Map<String, String> queryParams, Integer maxEntities) throws IOException {
    // List all entities and use it for checking pagination
    Random rand = new Random();

    for (Include include : List.of(Include.NON_DELETED, Include.ALL)) {
      if (!supportsSoftDelete && include.equals(Include.DELETED)) {
        continue;
      }
      queryParams.put("include", include.value());

      ResultList<T> allEntities = listEntitiesFromSearch(queryParams, 1000, 0, ADMIN_AUTH_HEADERS);
      int totalRecords = allEntities.getData().size();
      printEntities(allEntities);

      ResultList<T> forwardPage;
      ResultList<T> backwardPage;
      int offset;
      int cumEntityCount;
      // List entity with "limit" set from 1 to maxEntities size with random jumps
      for (int limit = 1; limit <= maxEntities; limit += rand.nextInt(5) + 1) {
        offset = 0;
        cumEntityCount = 0;
        int pageCount = 0;
        do {
          LOG.debug(
              "Limit {} forward pageCount {} totalRecords {} offset {}",
              limit,
              pageCount,
              totalRecords,
              offset);
          forwardPage = listEntitiesFromSearch(queryParams, limit, offset, ADMIN_AUTH_HEADERS);
          assertEntityPagination(allEntities.getData(), forwardPage, limit, offset);

          if (pageCount == 0) { // First page is being returned. Offset should be 0
            assertEquals(offset, 0);
          } else {
            // Make sure scrolling back based on offset - limit cursor returns the correct result
            backwardPage =
                listEntitiesFromSearch(queryParams, limit, (offset - limit), ADMIN_AUTH_HEADERS);
            assertEntityPagination(allEntities.getData(), forwardPage, limit, offset);
          }
          offset = offset + limit;
          cumEntityCount += forwardPage.getData().size();
          printEntities(forwardPage);
          pageCount++;
        } while (offset < totalRecords);

        // We reached the end of the page check total cum number matches total records and paginate
        // backward
        assertEquals(totalRecords, cumEntityCount);

        pageCount = 0;
        cumEntityCount = 0;

        do {
          LOG.debug(
              "Limit {} backward pageCount {} totalRecords {} offset {}",
              limit,
              pageCount,
              totalRecords,
              offset);
          offset = offset - limit;
          backwardPage = listEntitiesFromSearch(queryParams, limit, offset, ADMIN_AUTH_HEADERS);
          assertEntityPagination(allEntities.getData(), backwardPage, limit, offset);
          printEntities(backwardPage);
          cumEntityCount += backwardPage.getData().size();
          pageCount++;
        } while (offset > 0);
      }
    }
  }

  /** At the end of test for an entity, delete the parent container to test recursive delete functionality */
  private void delete_recursiveTest() throws IOException {
    // Skip recursive delete test when container reuse is enabled
    // as entities from previous test runs may still reference the container
    if (Boolean.parseBoolean(System.getProperty("testcontainers.reuse.enable", "false"))) {
      LOG.info("Skipping delete_recursiveTest - container reuse is enabled");
      return;
    }

    // Finally, delete the container that contains the entities created for this test
    EntityReference container = getContainer();
    if (container != null) {
      LOG.info(
          "delete_recursiveTest: Testing with container: {} (id: {}, type: {})",
          container.getName(),
          container.getId(),
          container.getType());

      // List both deleted and non deleted entities
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("include", Include.ALL.value());
      ResultList<T> listBeforeDeletion =
          listEntities(queryParams, 1000, null, null, ADMIN_AUTH_HEADERS);
      LOG.info(
          "delete_recursiveTest: Entities before deletion: {}",
          listBeforeDeletion.getData().size());

      // Delete non-empty container entity and ensure deletion is not allowed
      EntityResourceTest<? extends EntityInterface, ? extends CreateEntity> containerTest =
          ENTITY_RESOURCE_TEST_MAP.get(container.getType());
      assertResponse(
          () -> containerTest.deleteEntity(container.getId(), ADMIN_AUTH_HEADERS),
          BAD_REQUEST,
          entityIsNotEmpty(container.getType()));

      // Now soft-delete the container with recursive flag on
      LOG.info(
          "delete_recursiveTest: Soft-deleting container {} with recursive flag",
          container.getName());
      containerTest.deleteEntity(container.getId(), true, false, ADMIN_AUTH_HEADERS);

      // Make sure entities that belonged to the container are deleted and the new list operation
      // returns fewer entities
      ResultList<T> listAfterDeletion = listEntities(null, 1000, null, null, ADMIN_AUTH_HEADERS);
      listAfterDeletion
          .getData()
          .forEach(e -> assertNotEquals(getContainer(e).getId(), container.getId()));
      assertTrue(listAfterDeletion.getData().size() < listBeforeDeletion.getData().size());
      LOG.info(
          "delete_recursiveTest: Entities after deletion: {}", listAfterDeletion.getData().size());

      // Restore the soft-deleted container by PUT operation and make sure it is restored
      String containerName = container.getName();
      if (containerTest.getContainer() != null) {
        // Find container name by removing parentContainer fqn from container fqn. Example: remove
        // "service" from "service.database" to get "database" container name for table
        String parentOfContainer = containerTest.getContainer().getName();
        containerName = container.getName().replace(parentOfContainer + Entity.SEPARATOR, "");
      }
      LOG.info(
          "delete_recursiveTest: Attempting to restore container with name: {}", containerName);
      CreateEntity request = containerTest.createRequest(containerName, "", "", null);
      containerTest.updateEntity(request, Response.Status.OK, ADMIN_AUTH_HEADERS);

      ResultList<T> listAfterRestore = listEntities(null, 1000, null, null, ADMIN_AUTH_HEADERS);
      assertEquals(listBeforeDeletion.getData().size(), listAfterRestore.getData().size());

      // Now hard-delete the container with recursive flag on and make sure GET operation can't get
      // the entity
      containerTest.deleteEntity(container.getId(), true, true, ADMIN_AUTH_HEADERS);
      containerTest.assertEntityDeleted(container.getId(), true);
    }
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void get_entityListWithInvalidLimit_4xx() {
    // Limit must be >= 1 and <= 1000,000
    assertResponse(
        () -> listEntities(null, -1, null, null, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param limit must be greater than or equal to 0]");

    assertResponse(
        () -> listEntities(null, -1, null, null, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param limit must be greater than or equal to 0]");

    assertResponse(
        () -> listEntities(null, 1000001, null, null, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param limit must be less than or equal to 1000000]");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void get_entityListWithInvalidPaginationCursors_4xx() {
    // Passing both before and after cursors is invalid
    assertResponse(
        () -> listEntities(null, 1, "", "", ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Only one of before or after query parameter allowed");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void get_entityWithDifferentFields_200_OK(TestInfo test) throws IOException {
    // NOTE: Due to the Async nature of Glossary Approval Workflows, we have a specific test for
    // Glossary Terms.
    Assumptions.assumeTrue(!entityType.equals(GLOSSARY_TERM));
    K create =
        createRequest(
            getEntityName(test), "description", "displayName", Lists.newArrayList(USER1_REF));

    if (supportsReviewers) {
      create.setReviewers(List.of(USER1_REF));
    }

    T entity = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    if (supportsTags) {
      String origJson = JsonUtils.pojoToJson(entity);
      entity.setTags(new ArrayList<>());
      entity.getTags().add(USER_ADDRESS_TAG_LABEL);
      entity.getTags().add(GLOSSARY2_TERM1_LABEL);
      entity = patchEntity(entity.getId(), origJson, entity, ADMIN_AUTH_HEADERS);
    }
    if (supportsFollowers) {
      UserResourceTest userResourceTest = new UserResourceTest();
      User user1 =
          userResourceTest.createEntity(
              userResourceTest.createRequest(test, 1), USER_WITH_CREATE_HEADERS);
      addFollower(entity.getId(), user1.getId(), OK, TEST_AUTH_HEADERS);
    }

    entity = validateGetWithDifferentFields(entity, false);
    validateGetCommonFields(entity);

    entity = validateGetWithDifferentFields(entity, true);
    validateGetCommonFields(entity);
  }

  private void validateGetCommonFields(EntityInterface entityInterface) {
    if (supportsOwners) {
      validateEntityReferences(entityInterface.getOwners());
    }
    if (supportsFollowers) {
      validateEntityReferences(entityInterface.getFollowers(), true);
    }
    if (supportsTags) {
      assertListNotEmpty(entityInterface.getTags());
    }
  }

  @Test
  void get_deletedVersion(TestInfo test) throws IOException {
    if (!supportsSoftDelete) {
      return;
    }
    // Create an entity
    T entity = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    getEntity(entity.getId(), allFields, ADMIN_AUTH_HEADERS);
    Double previousVersion = entity.getVersion();

    // Soft-delete the entity
    deleteAndCheckEntity(entity, ADMIN_AUTH_HEADERS);
    EntityHistory history = getVersionList(entity.getId(), ADMIN_AUTH_HEADERS);

    // Get all the entity version
    entity = JsonUtils.readValue((String) history.getVersions().get(0), entityClass);
    assertEquals(EntityUtil.nextVersion(previousVersion), entity.getVersion());

    // Get the deleted entity version from versions API
    getVersion(entity.getId(), entity.getVersion(), ADMIN_AUTH_HEADERS);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void get_entityIncludeDeleted_200(TestInfo test) throws IOException {
    if (!supportsSoftDelete) {
      return;
    }
    // Create an entity using POST
    K create = createRequest(test);
    T entity = createEntity(create, ADMIN_AUTH_HEADERS);
    T entityBeforeDeletion = getEntity(entity.getId(), allFields, ADMIN_AUTH_HEADERS);

    // Soft delete the entity
    deleteAndCheckEntity(entity, ADMIN_AUTH_HEADERS);
    assertEntityDeleted(entity, false);

    // Ensure entity is returned in GET with include param set to deleted || all
    Map<String, String> queryParams = new HashMap<>();
    for (Include include : List.of(Include.DELETED, Include.ALL)) {
      queryParams.put("include", include.value());
      T entityAfterDeletion = getEntity(entity.getId(), queryParams, allFields, ADMIN_AUTH_HEADERS);
      validateDeletedEntity(create, entityBeforeDeletion, entityAfterDeletion, ADMIN_AUTH_HEADERS);
      entityAfterDeletion =
          getEntityByName(
              entity.getFullyQualifiedName(), queryParams, allFields, ADMIN_AUTH_HEADERS);
      validateDeletedEntity(create, entityBeforeDeletion, entityAfterDeletion, ADMIN_AUTH_HEADERS);
    }
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void get_entityWithNullDescriptionFromSearch(TestInfo test) throws IOException {
    Assumptions.assumeTrue(supportsSearchIndex);
    Assumptions.assumeTrue(
        Arrays.asList(entityClass.getInterfaces()).contains(EntityInterface.class));
    // We can't create a Glossary or a Tag without description
    Assumptions.assumeTrue(
        !List.of(GLOSSARY, TAG, QUERY, TEST_CASE, TEST_SUITE).contains(entityType));
    // Create an entity without description
    K createWithNullDescription = createRequest(test, 1).withDescription(null);
    T entityWithNullDescription = createEntity(createWithNullDescription, ADMIN_AUTH_HEADERS);

    // Check if the descriptionStatus is set to INCOMPLETE
    Map<String, Object> sourceAsMap =
        waitForSyncAndGetFromSearchIndex(
            entityWithNullDescription.getUpdatedAt(),
            entityWithNullDescription.getId(),
            entityType);
    assertEquals("INCOMPLETE", sourceAsMap.get("descriptionStatus"));

    // Try to search entity with INCOMPLETE description
    RestClient searchClient = getSearchClient();
    IndexMapping index = Entity.getSearchRepository().getIndexMapping(entityType);
    es.org.elasticsearch.client.Response response;
    // Direct request to es needs to have es clusterAlias appended with indexName
    Request request =
        new Request(
            "GET",
            String.format(
                "%s/_search", index.getIndexName(Entity.getSearchRepository().getClusterAlias())));
    String query =
        "{\"size\": 100,\"query\":{\"bool\":{\"must\":[{\"term\":{\"descriptionStatus\":\"INCOMPLETE\"}}]}}}";
    request.setJsonEntity(query);
    try {
      response = searchClient.performRequest(request);
    } finally {
      searchClient.close();
    }

    String jsonString = EntityUtils.toString(response.getEntity());
    HashMap<String, Object> map =
        (HashMap<String, Object>) JsonUtils.readOrConvertValue(jsonString, HashMap.class);
    LinkedHashMap<String, Object> hits = (LinkedHashMap<String, Object>) map.get("hits");
    ArrayList<LinkedHashMap<String, Object>> hitsList =
        (ArrayList<LinkedHashMap<String, Object>>) hits.get("hits");

    assertTrue(
        hitsList.stream()
            .anyMatch(
                hit ->
                    ((LinkedHashMap<String, Object>) hit.get("_source"))
                        .get("name")
                        .equals(createWithNullDescription.getName())));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void get_entityWithEmptyDescriptionFromSearch(TestInfo test) throws IOException {
    Assumptions.assumeTrue(supportsSearchIndex);
    Assumptions.assumeTrue(
        Arrays.asList(entityClass.getInterfaces()).contains(EntityInterface.class));
    Assumptions.assumeTrue(!List.of(QUERY, TEST_CASE, TEST_SUITE).contains(entityType));
    // Create an entity with empty description
    K createWithEmptyDescription = createRequest(test, 2);
    T entityWithEmptyDescription = createEntity(createWithEmptyDescription, ADMIN_AUTH_HEADERS);
    // Create an entity with empty description
    K createWithDescription = createRequest(test, 3).withDescription("description");
    T entityWithDescription = createEntity(createWithDescription, ADMIN_AUTH_HEADERS);

    // Search for entities without description
    RestClient searchClient = getSearchClient();
    IndexMapping index = Entity.getSearchRepository().getIndexMapping(entityType);
    es.org.elasticsearch.client.Response response;
    // Direct request to es needs to have es clusterAlias appended with indexName
    Request request =
        new Request(
            "GET",
            String.format(
                "%s/_search", index.getIndexName(Entity.getSearchRepository().getClusterAlias())));
    String query =
        "{\"size\": 100,\"query\":{\"bool\":{\"must\":[{\"term\":{\"descriptionStatus\":\"INCOMPLETE\"}}]}}}";
    request.setJsonEntity(query);
    response = searchClient.performRequest(request);
    searchClient.close();

    String jsonString = EntityUtils.toString(response.getEntity());
    HashMap<String, Object> map =
        (HashMap<String, Object>) JsonUtils.readOrConvertValue(jsonString, HashMap.class);
    LinkedHashMap<String, Object> hits = (LinkedHashMap<String, Object>) map.get("hits");
    ArrayList<LinkedHashMap<String, Object>> hitsList =
        (ArrayList<LinkedHashMap<String, Object>>) hits.get("hits");

    assertTrue(
        hitsList.stream()
            .noneMatch(
                hit ->
                    ((LinkedHashMap<String, Object>) hit.get("_source"))
                        .get("name")
                        .equals(createWithDescription.getName())));
    assertTrue(
        hitsList.stream()
            .anyMatch(
                hit ->
                    ((LinkedHashMap<String, Object>) hit.get("_source"))
                        .get("name")
                        .equals(createWithEmptyDescription.getName())));
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////
  // Common entity tests for POST operations
  //////////////////////////////////////////////////////////////////////////////////////////////////
  @Test
  @Execution(ExecutionMode.CONCURRENT)
  protected void post_entityCreateWithInvalidName_400() {
    // Create an entity with mandatory name field null
    final K request = createRequest(null, "description", "displayName", null);
    assertResponseContains(
        () -> createEntity(request, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param name must not be null]");

    // Create an entity with mandatory name field empty
    final K request1 = createRequest("", "description", "displayName", null);
    assertResponseContains(
        () -> createEntity(request1, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        TestUtils.getEntityNameLengthError(entityClass));

    // Create an entity with mandatory name field too long
    final K request2 = createRequest(LONG_ENTITY_NAME, "description", "displayName", null);
    assertResponse(
        () -> createEntity(request2, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        TestUtils.getEntityNameLengthError(entityClass));

    // Any entity name that has EntityLink separator must fail
    final K request3 = createRequest("invalid::Name", "description", "displayName", null);
    assertResponseContains(
        () -> createEntity(request3, ADMIN_AUTH_HEADERS), BAD_REQUEST, "name must match");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void post_entityWithMissingDescription_400(TestInfo test) {
    // Post entity that does not accept empty description and expect failure
    if (supportsEmptyDescription) {
      return;
    }

    final K create = createRequest(test).withDescription(null);
    assertResponseContains(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "description must not be null");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void post_entityWithInvalidOwnerType_4xx(TestInfo test) throws HttpResponseException {
    if (!supportsOwners) {
      return;
    }
    EntityReference owner = new EntityReference().withId(TEAM1.getId()); /* No owner type is set */
    K create = createRequest(getEntityName(test), "", "", Lists.newArrayList(owner));
    assertResponseContains(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "type must not be null");

    // Only Team of type Group is allowed to own entities
    List<Team> teams =
        new TeamResourceTest()
            .getTeamOfTypes(test, TeamType.BUSINESS_UNIT, TeamType.DIVISION, TeamType.DEPARTMENT);
    teams.add(ORG_TEAM);
    for (Team team : teams) {
      K create1 =
          createRequest(getEntityName(test), "", "", Lists.newArrayList(team.getEntityReference()));
      assertResponseContains(
          () -> createEntity(create1, ADMIN_AUTH_HEADERS),
          BAD_REQUEST,
          CatalogExceptionMessage.invalidTeamOwner(team.getTeamType()));
    }
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void post_entityWithNonExistentOwner_4xx(TestInfo test) {
    if (!supportsOwners) {
      return;
    }
    EntityReference owner = new EntityReference().withId(NON_EXISTENT_ENTITY).withType("user");
    K create = createRequest(getEntityName(test), "", "", Lists.newArrayList(owner));
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.USER, NON_EXISTENT_ENTITY));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void post_delete_entity_as_admin_200(TestInfo test) throws IOException {
    K request = createRequest(getEntityName(test), "", "", null);
    T entity = createEntity(request, ADMIN_AUTH_HEADERS);
    deleteAndCheckEntity(entity, ADMIN_AUTH_HEADERS); // Delete by ID
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void post_delete_as_name_entity_as_admin_200(TestInfo test) throws IOException {
    K request = createRequest(getEntityName(test), "", "", null);
    T entity = createEntity(request, ADMIN_AUTH_HEADERS);
    deleteByNameAndCheckEntity(entity, false, false, ADMIN_AUTH_HEADERS); // Delete by name
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  protected void post_delete_entityWithOwner_200(TestInfo test) throws IOException {
    if (!supportsOwners) {
      return;
    }

    TeamResourceTest teamResourceTest = new TeamResourceTest();
    CreateTeam createTeam = teamResourceTest.createRequest(test);
    Team team = teamResourceTest.createAndCheckEntity(createTeam, ADMIN_AUTH_HEADERS);

    // Entity with user as owner is created successfully. Owner should be able to delete the entity
    T entity1 =
        createAndCheckEntity(
            createRequest(getEntityName(test, 1), "", "", Lists.newArrayList(USER1_REF)),
            ADMIN_AUTH_HEADERS);
    deleteEntity(entity1.getId(), true, true, authHeaders(USER1.getName()));
    assertEntityDeleted(entity1.getId(), true);

    // Entity with team as owner is created successfully
    T entity2 =
        createAndCheckEntity(
            createRequest(
                getEntityName(test, 2), "", "", Lists.newArrayList(team.getEntityReference())),
            ADMIN_AUTH_HEADERS);

    // As ADMIN delete the team and ensure the entity still exists but with owner as deleted
    teamResourceTest.deleteEntity(team.getId(), ADMIN_AUTH_HEADERS);
    entity2 = getEntity(entity2.getId(), FIELD_OWNERS, ADMIN_AUTH_HEADERS);
    for (EntityReference owner : entity2.getOwners()) {
      assertTrue(owner.getDeleted());
    }
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  protected void post_delete_entity_as_bot(TestInfo test) throws IOException {
    if (supportsOwners || supportsAdminOnly) {
      return;
    }
    // Ingestion bot can create and delete all the entities except websocket and bot
    if (List.of(Entity.EVENT_SUBSCRIPTION, Entity.BOT).contains(entityType)) {
      return;
    }
    // Delete by ID
    T entity = createEntity(createRequest(test), INGESTION_BOT_AUTH_HEADERS);
    deleteAndCheckEntity(entity, INGESTION_BOT_AUTH_HEADERS);

    // Delete by name
    entity = createEntity(createRequest(test, 1), INGESTION_BOT_AUTH_HEADERS);
    deleteByNameAndCheckEntity(entity, false, false, INGESTION_BOT_AUTH_HEADERS);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  protected void post_entity_as_non_admin_401(TestInfo test) {
    if (supportsAdminOnly) {
      return;
    }
    assertResponse(
        () -> createEntity(createRequest(test), TEST_AUTH_HEADERS),
        FORBIDDEN,
        List.of(
            permissionNotAllowed(TEST_USER_NAME, List.of(MetadataOperation.CREATE)),
            "User does not have ANY of the required permissions."));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  protected void post_entityAlreadyExists_409_conflict(TestInfo test) throws HttpResponseException {
    K create = createRequest(getEntityName(test), "", "", null);
    // Create first time using POST
    createEntity(create, ADMIN_AUTH_HEADERS);
    // Second time creating the same entity using POST should fail
    assertResponse(() -> createEntity(create, ADMIN_AUTH_HEADERS), CONFLICT, ENTITY_ALREADY_EXISTS);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  protected void post_entityWithDots_200() throws HttpResponseException {
    if (!supportedNameCharacters.contains(".")) { // Name does not support dot
      return;
    }

    // Now post entity name with dots. FullyQualifiedName must have " to escape dotted name
    String name = format("%s_foo.bar", entityType);
    K request = createRequest(name, "", null, null);
    T entity = createEntity(request, ADMIN_AUTH_HEADERS);

    // The FQN has quote delimited parts if the FQN is hierarchical.
    // For entities where FQN is same as the entity name, (that is no hierarchical name for entities
    // like user, team, webhook and the entity names that are at the root for FQN like services,
    // Classification, and Glossary etc.), no delimiter is expected.
    boolean noHierarchicalName = entity.getFullyQualifiedName().equals(entity.getName());
    assertTrue(noHierarchicalName || entity.getFullyQualifiedName().contains("\""));
    assertEquals(name, entity.getName());
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////
  // Common entity tests for PUT operations
  //////////////////////////////////////////////////////////////////////////////////////////////////
  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void put_entityCreate_200(TestInfo test) throws IOException {
    // Create a new entity with PUT
    K request = createRequest(getEntityName(test), "description", "displayName", null);
    updateAndCheckEntity(request, Status.CREATED, ADMIN_AUTH_HEADERS, CREATED, null);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void put_entityUpdateWithNoChange_200(TestInfo test) throws IOException {
    // Create a chart with POST
    K request =
        createRequest(getEntityName(test), "description", "display", Lists.newArrayList(USER1_REF));
    T entity = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Update chart two times successfully with PUT requests
    ChangeDescription change = getChangeDescription(entity, NO_CHANGE);
    updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, NO_CHANGE, change);
    updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, NO_CHANGE, change);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void put_entityCreate_as_owner_200(TestInfo test) throws IOException {
    if (!supportsOwners) {
      return; // Entity doesn't support ownership
    }
    // Create a new entity with PUT as admin user
    K request = createRequest(getEntityName(test), "", null, Lists.newArrayList(USER1_REF));
    T entity = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Update the entity as USER1
    request.withDescription("newDescription");
    ChangeDescription change = getChangeDescription(entity, MINOR_UPDATE);
    fieldUpdated(change, "description", "", "newDescription");
    updateAndCheckEntity(request, OK, authHeaders(USER1.getEmail()), MINOR_UPDATE, change);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void put_entityUpdateOwner_200(TestInfo test) throws IOException {
    if (!supportsOwners) {
      return; // Entity doesn't support ownership
    }
    // Create an entity without owner
    K request = createRequest(getEntityName(test), "description", "displayName", null);
    T entity = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Set TEAM_OWNER1 as owner using PUT request
    request.setOwners(Lists.newArrayList(TEAM11_REF));
    ChangeDescription change = getChangeDescription(entity, MINOR_UPDATE);
    fieldAdded(change, FIELD_OWNERS, List.of(TEAM11_REF));
    entity = updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    checkOwnerOwns(TEAM11.getEntityReference(), entity.getId(), true);

    // Change owner from TEAM_OWNER1 to USER_OWNER1 using PUT request
    request.setOwners(Lists.newArrayList(USER1_REF));
    change = getChangeDescription(entity, MINOR_UPDATE);
    fieldAdded(change, FIELD_OWNERS, List.of(USER1_REF));
    fieldDeleted(change, FIELD_OWNERS, List.of(TEAM11_REF));
    entity = updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    checkOwnerOwns(USER1_REF, entity.getId(), true);
    checkOwnerOwns(TEAM11_REF, entity.getId(), false);

    // Set the owner to the existing owner. No ownership change must be recorded.
    request.setOwners(null);
    change = getChangeDescription(entity, NO_CHANGE);
    entity = updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, NO_CHANGE, change);
    checkOwnerOwns(USER1_REF, entity.getId(), true);

    // Remove ownership (from USER_OWNER1) using PUT request. Owner is expected to remain the same
    // and not removed.
    request = createRequest(entity.getName(), "description", "displayName", null);
    updateEntity(request, OK, ADMIN_AUTH_HEADERS);
    checkOwnerOwns(USER1_REF, entity.getId(), true);
  }

  @Test
  void test_entityWithInvalidTag(TestInfo test) throws HttpResponseException {
    if (!supportsTags) {
      return;
    }
    // Add an entity with invalid tag
    TagLabel invalidTag = new TagLabel().withTagFQN("invalidTag");
    CreateEntity create = createRequest(getEntityName(test));
    create.setTags(listOf(invalidTag));

    // Entity can't be created with PUT or POST
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    assertResponse(
        () -> updateEntity(create, Status.CREATED, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    // Create an entity and update it with PUT and PATCH with an invalid flag
    create.setTags(null);
    T entity = createEntity(create, ADMIN_AUTH_HEADERS);
    String json = JsonUtils.pojoToJson(entity);

    create.setTags(listOf(invalidTag));
    assertResponse(
        () -> updateEntity(create, Status.CREATED, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    entity.setTags(listOf(invalidTag));
    assertResponse(
        () -> patchEntity(entity.getId(), json, entity, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    // No lingering relationships should cause error in listing the entity
    listEntities(null, ADMIN_AUTH_HEADERS);
  }

  @Test
  void test_tagUpdateOptimization_PUT(TestInfo test) throws HttpResponseException {
    if (!supportsTags) {
      return;
    }

    TagLabel tag1 = new TagLabel().withTagFQN("PII.Sensitive");
    TagLabel tag2 = new TagLabel().withTagFQN("Tier.Tier1");
    CreateEntity create = createRequest(getEntityName(test));
    create.setTags(listOf(tag1, tag2));
    T entity = createEntity(create, ADMIN_AUTH_HEADERS);

    // Verify initial tags
    entity = getEntity(entity.getId(), "tags", ADMIN_AUTH_HEADERS);
    assertEquals(2, entity.getTags().size());
    assertTagsContain(entity.getTags(), listOf(tag1, tag2));

    // PUT with one new tag - should ADD the new tag without removing existing ones
    TagLabel tag3 = new TagLabel().withTagFQN("PersonalData.Personal");
    create.setTags(listOf(tag3));
    T updated = updateEntity(create, Status.OK, ADMIN_AUTH_HEADERS);

    // Verify all three tags are present (PUT merges tags)
    updated = getEntity(updated.getId(), "tags", ADMIN_AUTH_HEADERS);
    assertEquals(3, updated.getTags().size());
    assertTagsContain(updated.getTags(), listOf(tag1, tag2, tag3));

    // PUT with existing tags - should not duplicate
    create.setTags(listOf(tag1, tag3));
    updated = updateEntity(create, Status.OK, ADMIN_AUTH_HEADERS);

    // Verify still three tags (no duplicates)
    updated = getEntity(updated.getId(), "tags", ADMIN_AUTH_HEADERS);
    assertEquals(3, updated.getTags().size());
    assertTagsContain(updated.getTags(), listOf(tag1, tag2, tag3));
  }

  @Test
  void test_tagUpdateOptimization_PATCH(TestInfo test) throws HttpResponseException {
    if (!supportsTags) {
      return;
    }

    TagLabel tag1 = new TagLabel().withTagFQN("PII.Sensitive");
    TagLabel tag2 = new TagLabel().withTagFQN("Tier.Tier1");
    CreateEntity create = createRequest(getEntityName(test));
    create.setTags(listOf(tag1, tag2));
    T entity = createEntity(create, ADMIN_AUTH_HEADERS);

    entity = getEntity(entity.getId(), "tags", ADMIN_AUTH_HEADERS);
    assertEquals(2, entity.getTags().size());
    assertTagsContain(entity.getTags(), listOf(tag1, tag2));

    // PATCH with different tags - should REPLACE all tags
    TagLabel tag3 = new TagLabel().withTagFQN("PersonalData.Personal");
    TagLabel tag4 = new TagLabel().withTagFQN("Certification.Bronze");
    String originalJson = JsonUtils.pojoToJson(entity);
    entity.setTags(listOf(tag3, tag4));
    T patched = patchEntity(entity.getId(), originalJson, entity, ADMIN_AUTH_HEADERS);

    // Verify only new tags are present (PATCH replaces tags)
    patched = getEntity(patched.getId(), "tags", ADMIN_AUTH_HEADERS);
    assertEquals(2, patched.getTags().size());
    assertTagsContain(patched.getTags(), listOf(tag3, tag4));
    assertTagsDoNotContain(patched.getTags(), listOf(tag1, tag2));

    // PATCH with empty tags - should remove all tags
    originalJson = JsonUtils.pojoToJson(patched);
    patched.setTags(new ArrayList<>());
    patched = patchEntity(patched.getId(), originalJson, patched, ADMIN_AUTH_HEADERS);

    // Verify no tags
    patched = getEntity(patched.getId(), "tags", ADMIN_AUTH_HEADERS);
    assertTrue(patched.getTags().isEmpty());
  }

  @Test
  void test_tagUpdateOptimization_LargeScale(TestInfo test) throws HttpResponseException {
    if (!supportsTags) {
      return;
    }

    // Create entity with initial tags (from different classifications)
    List<TagLabel> initialTags = new ArrayList<>();
    initialTags.add(
        new TagLabel()
            .withTagFQN("PII.Sensitive")
            .withLabelType(TagLabel.LabelType.MANUAL)
            .withState(TagLabel.State.CONFIRMED));
    initialTags.add(
        new TagLabel()
            .withTagFQN("Tier.Tier1")
            .withLabelType(TagLabel.LabelType.MANUAL)
            .withState(TagLabel.State.CONFIRMED));

    CreateEntity create = createRequest(getEntityName(test));
    create.setTags(initialTags);
    T entity = createEntity(create, ADMIN_AUTH_HEADERS);

    // Verify we have 2 unique tags
    entity = getEntity(entity.getId(), "tags", ADMIN_AUTH_HEADERS);
    assertEquals(2, entity.getTags().size());

    // Add more unique tags via PUT - should be efficient (only adds new ones)
    List<TagLabel> additionalTags = new ArrayList<>();
    additionalTags.add(
        new TagLabel()
            .withTagFQN("PersonalData.Personal")
            .withLabelType(TagLabel.LabelType.MANUAL)
            .withState(TagLabel.State.CONFIRMED));
    additionalTags.add(
        new TagLabel()
            .withTagFQN("Certification.Bronze")
            .withLabelType(TagLabel.LabelType.MANUAL)
            .withState(TagLabel.State.CONFIRMED));

    create.setTags(additionalTags);

    long startTime = System.currentTimeMillis();
    T updated = updateEntity(create, Status.OK, ADMIN_AUTH_HEADERS);
    long updateTime = System.currentTimeMillis() - startTime;

    updated = getEntity(updated.getId(), "tags", ADMIN_AUTH_HEADERS);
    assertEquals(4, updated.getTags().size());
    assertTagsContain(updated.getTags(), initialTags);
    assertTagsContain(updated.getTags(), additionalTags);
  }

  private void assertTagsContain(List<TagLabel> tags, List<TagLabel> expectedTags) {
    for (TagLabel expected : expectedTags) {
      assertTrue(
          tags.stream().anyMatch(tag -> tag.getTagFQN().equals(expected.getTagFQN())),
          "Tags should contain: " + expected.getTagFQN());
    }
  }

  private void assertTagsDoNotContain(List<TagLabel> tags, List<TagLabel> unexpectedTags) {
    for (TagLabel unexpected : unexpectedTags) {
      assertFalse(
          tags.stream().anyMatch(tag -> tag.getTagFQN().equals(unexpected.getTagFQN())),
          "Tags should not contain: " + unexpected.getTagFQN());
    }
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void patch_validEntityOwner_200(TestInfo test) throws IOException {
    if (!supportsOwners || !supportsPatch) {
      return; // Entity doesn't support ownership
    }

    // Create an entity without owner
    K request = createRequest(getEntityName(test), "", "", null);
    T entity = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Only team of type `group` is allowed to own the entities
    String json = JsonUtils.pojoToJson(entity);
    List<Team> teams =
        new TeamResourceTest()
            .getTeamOfTypes(test, TeamType.BUSINESS_UNIT, TeamType.DIVISION, TeamType.DEPARTMENT);
    teams.add(ORG_TEAM);
    for (Team team : teams) {
      entity.setOwners(List.of(team.getEntityReference()));
      assertResponseContains(
          () -> patchEntity(entity.getId(), json, entity, ADMIN_AUTH_HEADERS),
          BAD_REQUEST,
          CatalogExceptionMessage.invalidTeamOwner(team.getTeamType()));
    }
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void patch_entityUpdateOwner_200(TestInfo test) throws IOException {
    if (!supportsOwners || !supportsPatch) {
      return; // Entity doesn't support ownership
    }
    // V0.1 - Create an entity without owner
    K request = createRequest(getEntityName(test), "description", "displayName", null);
    T entity = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // V0.2 - Set TEAM_OWNER1 as owner from no owner using PATCH request
    String json = JsonUtils.pojoToJson(entity);
    entity.setOwners(List.of(TEAM11_REF));
    ChangeDescription change = getChangeDescription(entity, MINOR_UPDATE);
    fieldAdded(change, FIELD_OWNERS, List.of(TEAM11_REF));
    entity = patchEntityAndCheck(entity, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    checkOwnerOwns(TEAM11_REF, entity.getId(), true);

    // V0-2 (consolidated) - Change owner from TEAM_OWNER1 to USER_OWNER1 using PATCH request
    json = JsonUtils.pojoToJson(entity);
    entity.setOwners(List.of(USER1_REF));
    change = getChangeDescription(entity, getChangeType());
    fieldAdded(change, FIELD_OWNERS, List.of(USER1_REF));
    fieldDeleted(change, FIELD_OWNERS, List.of(TEAM11_REF));
    entity = patchEntityAndCheck(entity, json, ADMIN_AUTH_HEADERS, getChangeType(), change);
    checkOwnerOwns(USER1_REF, entity.getId(), true);
    checkOwnerOwns(TEAM11_REF, entity.getId(), false);

    change = new ChangeDescription().withPreviousVersion(entity.getVersion());
    json = JsonUtils.pojoToJson(entity);
    entity.setOwners(List.of(USER1_REF));
    entity = patchEntityAndCheck(entity, json, ADMIN_AUTH_HEADERS, NO_CHANGE, change);
    checkOwnerOwns(USER1_REF, entity.getId(), true);

    // V0.1 (revert) - Remove ownership (USER_OWNER1) using PATCH. We are back to original state no
    // owner and no change
    json = JsonUtils.pojoToJson(entity);
    entity.setOwners(null);
    change = getChangeDescription(entity, MINOR_UPDATE);
    fieldDeleted(change, FIELD_OWNERS, List.of(USER1_REF));
    patchEntityAndCheck(entity, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    checkOwnerOwns(USER1_REF, entity.getId(), false);

    // set random type as entity. Check if the ownership validate.
    T newEntity = entity;
    String newJson = JsonUtils.pojoToJson(newEntity);
    newEntity.getOwners().add(TEST_DEFINITION1.getEntityReference());
    assertResponse(
        () -> patchEntity(newEntity.getId(), newJson, newEntity, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.invalidOwnerType(TEST_DEFINITION));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void patch_entityUpdateOwnerFromNull_200(TestInfo test) throws IOException {
    if (!supportsOwners || !supportsPatch) {
      return; // Entity doesn't support ownership
    }

    // Create Entity with Null Owner
    K request = createRequest(getEntityName(test), "description", "displayName", null);
    T createdEntity = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    T entity = getEntity(createdEntity.getId(), allFields, ADMIN_AUTH_HEADERS);

    List<EntityReference> previousOwners = entity.getOwners();
    if (nullOrEmpty(previousOwners)) {
      entity.setOwners(null);
    }

    // Check if the Owner is update to user1 and user 2
    List<EntityReference> updateOwners =
        List.of(
            new EntityReference().withId(USER1.getId()).withType(USER),
            new EntityReference().withId(USER2.getId()).withType(USER));

    String json = JsonUtils.pojoToJson(entity);
    entity.setOwners(updateOwners);
    ChangeDescription change = getChangeDescription(entity, MINOR_UPDATE);
    fieldAdded(change, FIELD_OWNERS, updateOwners);
    entity = patchEntityAndCheck(entity, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertEntityReferences(updateOwners, entity.getOwners());
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void put_entityUpdate_as_non_owner_4xx(TestInfo test) throws IOException {
    if (!supportsOwners) {
      return; // Entity doesn't support ownership
    }

    // Create an entity with owner
    K request =
        createRequest(
            getEntityName(test), "description", "displayName", Lists.newArrayList(USER1_REF));
    T entity = createEntity(request, ADMIN_AUTH_HEADERS);

    // Update description and remove owner as non-owner
    // Expect to throw an exception since only owner or admin can update resource
    K updateRequest = createRequest(entity.getName(), "newDescription", "displayName", null);

    assertResponse(
        () -> updateEntity(updateRequest, OK, TEST_AUTH_HEADERS),
        FORBIDDEN,
        List.of(
            permissionNotAllowed(TEST_USER_NAME, List.of(MetadataOperation.EDIT_ALL)),
            "User does not have ANY of the required permissions."));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void put_entityNullDescriptionUpdate_200(TestInfo test) throws IOException {
    if (!supportsEmptyDescription) {
      return;
    }
    // Create entity with null description
    K request = createRequest(getEntityName(test), null, "displayName", null);
    T entity = createEntity(request, ADMIN_AUTH_HEADERS);

    // Update null description with a new description
    request = request.withDescription("updatedDescription");
    ChangeDescription change = getChangeDescription(entity, MINOR_UPDATE);
    fieldAdded(change, "description", "updatedDescription");
    updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  protected void put_entityEmptyDescriptionUpdate_200(TestInfo test) throws IOException {
    // Create entity with empty description
    K request = createRequest(getEntityName(test), "", "displayName", null);
    T entity = createEntity(request, ADMIN_AUTH_HEADERS);

    // Update empty description with a new description
    request.withDescription("updatedDescription");
    ChangeDescription change = getChangeDescription(entity, MINOR_UPDATE);
    fieldUpdated(change, "description", "", "updatedDescription");
    updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  protected void put_entityNonEmptyDescriptionUpdate_200(TestInfo test) throws IOException {
    if (supportsEmptyDescription) {
      return;
    }
    // Create entity with non-empty description
    K request =
        createRequest(
            getEntityName(test), supportsEmptyDescription ? null : "description", null, null);
    T entity = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    // BOT user can update empty description and empty displayName
    ChangeDescription change = getChangeDescription(entity, MINOR_UPDATE);
    request.withDescription("description").withDisplayName("displayName");
    if (supportsEmptyDescription) {
      fieldAdded(change, "description", "description");
    }
    fieldAdded(change, "displayName", "displayName");
    entity = updateAndCheckEntity(request, OK, INGESTION_BOT_AUTH_HEADERS, MINOR_UPDATE, change);

    // Updating non-empty description and non-empty displayName is allowed for users other than bots
    request.withDescription("updatedDescription").withDisplayName("updatedDisplayName");
    change = getChangeDescription(entity, MINOR_UPDATE);
    fieldUpdated(change, "description", "description", "updatedDescription");
    fieldUpdated(change, "displayName", "displayName", "updatedDisplayName");
    entity = updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Updating non-empty description is ignored for bot users
    request.withDescription("updatedDescription2");
    change = getChangeDescription(entity, NO_CHANGE);
    updateAndCheckEntity(request, OK, INGESTION_BOT_AUTH_HEADERS, NO_CHANGE, change);

    // Updating non-empty display name is allowed for bot users
    // revert to the last committed description, so only displayName is new
    request.withDescription("updatedDescription").withDisplayName("updatedDisplayName2");
    change = getChangeDescription(entity, MINOR_UPDATE);
    fieldUpdated(change, "displayName", "updatedDisplayName", "updatedDisplayName2");
    updateAndCheckEntity(request, OK, INGESTION_BOT_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void put_addDeleteFollower_200(TestInfo test) throws IOException {
    if (!supportsFollowers) {
      return; // Entity does not support following
    }
    K request = createRequest(getEntityName(test), "description", "displayName", null);
    T entity = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    UUID entityId = entity.getId();

    // Add follower to the entity
    UserResourceTest userResourceTest = new UserResourceTest();
    User user1 =
        userResourceTest.createEntity(
            userResourceTest.createRequest(test, 1), USER_WITH_CREATE_HEADERS);
    addAndCheckFollower(entityId, user1.getId(), OK, 1, TEST_AUTH_HEADERS);

    // Add the same user as follower and make sure no errors are thrown
    // (and not CREATED)
    addAndCheckFollower(entityId, user1.getId(), OK, 1, TEST_AUTH_HEADERS);

    // Add a new follower to the entity
    User user2 =
        userResourceTest.createEntity(
            userResourceTest.createRequest(test, 2), USER_WITH_CREATE_HEADERS);
    addAndCheckFollower(entityId, user2.getId(), OK, 2, TEST_AUTH_HEADERS);

    // Delete followers and make sure they are deleted
    deleteAndCheckFollower(entityId, user1.getId(), 1, TEST_AUTH_HEADERS);
    deleteAndCheckFollower(entityId, user2.getId(), 0, TEST_AUTH_HEADERS);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void put_addFollowerDeleteEntity_200(TestInfo test) throws IOException {
    if (!supportsFollowers) {
      return; // Entity does not support following
    }
    K request = createRequest(getEntityName(test), "description", "displayName", null);
    T entity = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    UUID entityId = entity.getId();

    // Add follower to the entity
    UserResourceTest userResourceTest = new UserResourceTest();
    User user1 =
        userResourceTest.createEntity(
            userResourceTest.createRequest(test, 1), USER_WITH_CREATE_HEADERS);
    addAndCheckFollower(entityId, user1.getId(), OK, 1, TEST_AUTH_HEADERS);

    deleteEntity(entityId, ADMIN_AUTH_HEADERS);

    // in case of only soft delete
    if (supportsSoftDelete) {
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("include", "deleted");
      entity = getEntity(entityId, queryParams, FIELD_FOLLOWERS, ADMIN_AUTH_HEADERS);
      TestUtils.existsInEntityReferenceList(entity.getFollowers(), user1.getId(), true);
    }
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void put_addDeleteInvalidFollower_200(TestInfo test) throws IOException {
    if (!supportsFollowers) {
      return; // Entity does not support following
    }
    K request = createRequest(getEntityName(test), "description", "displayName", null);
    T entity = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    UUID entityId = entity.getId();

    // Add non-existent user as follower to the entity
    assertResponse(
        () -> addAndCheckFollower(entityId, NON_EXISTENT_ENTITY, OK, 1, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.USER, NON_EXISTENT_ENTITY));

    // Delete non-existent user as follower to the entity
    assertResponse(
        () -> deleteAndCheckFollower(entityId, NON_EXISTENT_ENTITY, 1, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.USER, NON_EXISTENT_ENTITY));
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////
  // Common entity tests for PATCH operations
  //////////////////////////////////////////////////////////////////////////////////////////////////
  @Test
  @Execution(ExecutionMode.CONCURRENT)
  protected void patch_dataProducts_multipleOperations_200(TestInfo test) throws IOException {
    if (!supportsPatch || !supportsDataProducts || !supportsDomains) {
      return;
    }

    // Create entity without dataProducts
    T entity = createEntity(createRequest(test, 0), ADMIN_AUTH_HEADERS);

    // First add a domain (required for dataProducts)
    DomainResourceTest domainResourceTest = new DomainResourceTest();
    Domain domain =
        domainResourceTest.createEntity(domainResourceTest.createRequest(test), ADMIN_AUTH_HEADERS);
    EntityReference domainRef = domain.getEntityReference();

    String originalJson = JsonUtils.pojoToJson(entity);
    entity.setDomains(List.of(domainRef));
    ChangeDescription change = getChangeDescription(entity, MINOR_UPDATE);
    fieldAdded(change, FIELD_DOMAINS, List.of(domainRef));
    entity = patchEntityAndCheck(entity, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Create data products
    DataProductResourceTest dataProductResourceTest = new DataProductResourceTest();
    CreateDataProduct createDataProduct1 =
        dataProductResourceTest
            .createRequest(test)
            .withDomains(listOf(domainRef.getFullyQualifiedName()));
    DataProduct dataProduct1 =
        dataProductResourceTest.createEntity(createDataProduct1, ADMIN_AUTH_HEADERS);
    EntityReference dataProductRef1 = dataProduct1.getEntityReference();

    CreateDataProduct createDataProduct2 =
        dataProductResourceTest
            .createRequest(test, 1)
            .withDomains(listOf(domainRef.getFullyQualifiedName()));
    DataProduct dataProduct2 =
        dataProductResourceTest.createEntity(createDataProduct2, ADMIN_AUTH_HEADERS);
    EntityReference dataProductRef2 = dataProduct2.getEntityReference();

    // Test scenario 1: Add first dataProduct via PATCH
    originalJson = JsonUtils.pojoToJson(entity);
    entity.setDataProducts(List.of(dataProductRef1));
    change = getChangeDescription(entity, MINOR_UPDATE);
    fieldAdded(change, FIELD_DATA_PRODUCTS, List.of(dataProductRef1));
    T patched1 =
        patchEntityAndCheck(entity, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Verify patch response contains the first dataProduct
    assertNotNull(patched1.getDataProducts(), "Patch response should include dataProducts");
    assertEquals(1, patched1.getDataProducts().size(), "Should have 1 dataProduct");
    assertEquals(
        dataProductRef1.getId(),
        patched1.getDataProducts().get(0).getId(),
        "Should have the first dataProduct");

    // Test scenario 2: Add second dataProduct (now have 2)
    originalJson = JsonUtils.pojoToJson(patched1);
    patched1.setDataProducts(List.of(dataProductRef1, dataProductRef2));
    change = getChangeDescription(patched1, MINOR_UPDATE);
    fieldAdded(change, FIELD_DATA_PRODUCTS, List.of(dataProductRef2));
    T patched2 =
        patchEntityAndCheck(patched1, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Verify patch response contains both dataProducts
    assertNotNull(patched2.getDataProducts(), "Patch response should include dataProducts");
    assertEquals(2, patched2.getDataProducts().size(), "Should have 2 dataProducts");
    assertTrue(
        patched2.getDataProducts().stream()
            .anyMatch(dp -> dp.getId().equals(dataProductRef1.getId())),
        "Should contain first dataProduct");
    assertTrue(
        patched2.getDataProducts().stream()
            .anyMatch(dp -> dp.getId().equals(dataProductRef2.getId())),
        "Should contain second dataProduct");

    // Test scenario 3: Remove first dataProduct (keep only second)
    originalJson = JsonUtils.pojoToJson(patched2);
    patched2.setDataProducts(List.of(dataProductRef2));
    change = getChangeDescription(patched2, MINOR_UPDATE);
    fieldDeleted(change, FIELD_DATA_PRODUCTS, List.of(dataProductRef1));
    T patched3 =
        patchEntityAndCheck(patched2, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Verify patch response has only the second dataProduct
    assertNotNull(patched3.getDataProducts(), "Patch response should include dataProducts");
    assertEquals(1, patched3.getDataProducts().size(), "Should have 1 dataProduct after deletion");
    assertEquals(
        dataProductRef2.getId(),
        patched3.getDataProducts().get(0).getId(),
        "Should only have the second dataProduct");

    // Verify by fetching the entity that it persisted correctly
    T fetched = getEntity(patched3.getId(), FIELD_DATA_PRODUCTS, ADMIN_AUTH_HEADERS);
    assertNotNull(fetched.getDataProducts(), "Fetched entity should have dataProducts");
    assertEquals(1, fetched.getDataProducts().size(), "Fetched entity should have 1 dataProduct");
    assertEquals(
        dataProductRef2.getId(),
        fetched.getDataProducts().get(0).getId(),
        "Fetched entity should have only the second dataProduct");

    // Clean up: Remove dataProducts from entity before cleanup
    originalJson = JsonUtils.pojoToJson(patched3);
    patched3.setDataProducts(null);
    change = getChangeDescription(patched3, MINOR_UPDATE);
    fieldDeleted(change, FIELD_DATA_PRODUCTS, List.of(dataProductRef2));
    patched3 =
        patchEntityAndCheck(patched3, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Remove domain from entity
    originalJson = JsonUtils.pojoToJson(patched3);
    patched3.setDomains(null);
    change = getChangeDescription(patched3, MINOR_UPDATE);
    fieldDeleted(change, FIELD_DOMAINS, List.of(domainRef));
    patchEntityAndCheck(patched3, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Clean up created entities
    dataProductResourceTest.deleteEntity(dataProduct1.getId(), ADMIN_AUTH_HEADERS);
    dataProductResourceTest.deleteEntity(dataProduct2.getId(), ADMIN_AUTH_HEADERS);
    domainResourceTest.deleteEntity(domain.getId(), ADMIN_AUTH_HEADERS);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  protected void patch_entityDescriptionAndTestAuthorizer(TestInfo test) throws IOException {
    if (!supportsPatch || supportsAdminOnly) {
      return;
    }
    T entity =
        createEntity(
            createRequest(getEntityName(test), "description", null, null), ADMIN_AUTH_HEADERS);

    // Admins, Owner or a User with policy can update the entity without owner
    entity = patchEntityAndCheckAuthorization(entity, ADMIN_USER_NAME, false);
    entity = patchEntityAndCheckAuthorization(entity, DATA_STEWARD.getName(), false);
    entity = patchEntityAndCheckAuthorization(entity, USER1.getName(), false);
    entity = patchEntityAndCheckAuthorization(entity, DATA_CONSUMER.getName(), false);

    if (!supportsOwners) {
      return;
    }

    // Set the owner for the entity
    String originalJson = JsonUtils.pojoToJson(entity);
    ChangeDescription change = getChangeDescription(entity, MINOR_UPDATE);
    fieldAdded(change, FIELD_OWNERS, List.of(USER1_REF));
    entity.setOwners(List.of(USER1_REF));
    entity =
        patchEntityAndCheck(
            entity,
            originalJson,
            authHeaders(USER1.getName() + "@open-metadata.org"),
            MINOR_UPDATE,
            change);

    // Admin, owner (USER1) and user with DataSteward role can update the owner on entity owned by
    // USER1.
    entity = patchEntityAndCheckAuthorization(entity, ADMIN_USER_NAME, false);
    entity = patchEntityAndCheckAuthorization(entity, USER1.getName(), false);
    entity = patchEntityAndCheckAuthorization(entity, DATA_STEWARD.getName(), false);
    patchEntityAndCheckAuthorization(entity, DATA_CONSUMER.getName(), true);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void patch_entityAttributes_200_ok(TestInfo test) throws IOException {
    if (!supportsPatch) {
      return;
    }
    // Create entity without description, owner
    T entity = createEntity(createRequest(getEntityName(test), "", null, null), ADMIN_AUTH_HEADERS);
    // user will always have the same user assigned as the owner
    if (!Entity.getEntityTypeFromObject(entity).equals(Entity.USER)
        && entity.getOwners() != null
        && entity.getOwners().stream().noneMatch(EntityReference::getInherited)) {
      assertEquals(emptyList(), entity.getOwners());
    }
    entity = getEntity(entity.getId(), ADMIN_AUTH_HEADERS);

    //
    // Add displayName, description, owner, and tags when previously they were null
    //
    String origJson = JsonUtils.pojoToJson(entity);
    entity.setDescription("description");
    entity.setDisplayName("displayName");

    // Field changes
    ChangeDescription change = getChangeDescription(entity, MINOR_UPDATE);
    fieldUpdated(change, "description", "", "description");
    fieldAdded(change, "displayName", "displayName");
    if (supportsOwners) {
      entity.setOwners(Lists.newArrayList(TEAM11_REF));
      fieldAdded(change, FIELD_OWNERS, List.of(TEAM11_REF));
    }
    if (supportsTags) {
      entity.setTags(new ArrayList<>());
      entity.getTags().add(USER_ADDRESS_TAG_LABEL);
      entity
          .getTags()
          .add(USER_ADDRESS_TAG_LABEL); // Add duplicated tags and make sure only one tag is added
      entity.getTags().add(GLOSSARY2_TERM1_LABEL);
      entity
          .getTags()
          .add(GLOSSARY2_TERM1_LABEL); // Add duplicated tags and make sure only one tag is added
      fieldAdded(change, FIELD_TAGS, List.of(USER_ADDRESS_TAG_LABEL, GLOSSARY2_TERM1_LABEL));
    }

    entity = patchEntityAndCheck(entity, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    //
    // Replace description, add tags tier, owner - Changes are consolidated
    //
    origJson = JsonUtils.pojoToJson(entity);
    entity.setDescription("description1");
    entity.setDisplayName("displayName1");
    change = getChangeDescription(entity, MINOR_UPDATE);
    fieldUpdated(change, "description", "description", "description1");
    fieldUpdated(change, "displayName", "displayName", "displayName1");
    if (supportsOwners) {
      entity.setOwners(List.of(USER1_REF));
      fieldAdded(change, FIELD_OWNERS, List.of(USER1_REF));
      fieldDeleted(change, FIELD_OWNERS, List.of(TEAM11_REF));
    }

    if (supportsTags) {
      entity.getTags().add(TIER1_TAG_LABEL);
      fieldAdded(change, FIELD_TAGS, List.of(TIER1_TAG_LABEL));
    }
    entity = patchEntityAndCheck(entity, origJson, ADMIN_AUTH_HEADERS, getChangeType(), change);

    origJson = JsonUtils.pojoToJson(entity);
    change = getChangeDescription(entity, MINOR_UPDATE);
    entity.setDescription("");
    entity.setDisplayName(null);
    entity.setOwners(null);
    entity.setTags(null);
    fieldUpdated(change, "description", "description1", "");
    fieldDeleted(change, "displayName", "displayName1");
    if (supportsOwners) {
      fieldDeleted(change, FIELD_OWNERS, List.of(USER1_REF));
    }
    if (supportsTags) {
      fieldDeleted(change, FIELD_TAGS, List.of(TIER1_TAG_LABEL));
    }
    patchEntityAndCheck(entity, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void patch_deleted_attribute_disallowed_400(TestInfo test) throws HttpResponseException {
    if (!supportsPatch || !supportsSoftDelete) {
      return;
    }
    // `deleted` attribute can't be set to true in PATCH operation & can only be done using DELETE
    // operation
    T entity = createEntity(createRequest(getEntityName(test), "", "", null), ADMIN_AUTH_HEADERS);
    String json = JsonUtils.pojoToJson(entity);
    entity.setDeleted(true);
    assertResponse(
        () -> patchEntity(entity.getId(), json, entity, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        readOnlyAttribute(entityType, FIELD_DELETED));
  }

  @Test
  void patch_entityUpdatesOutsideASession(TestInfo test) throws IOException, InterruptedException {
    if (!supportsOwners) {
      return;
    }
    // Create an entity with user as owner
    K create =
        createRequest(getEntityName(test), "description", null, Lists.newArrayList(USER1_REF));
    T entity = createEntity(create, ADMIN_AUTH_HEADERS);

    // Update description with a new description and the version changes as admin
    String json = JsonUtils.pojoToJson(entity);
    entity.setDescription("description1");
    ChangeDescription change = getChangeDescription(entity, MINOR_UPDATE);
    fieldUpdated(change, "description", "description", "description1");
    entity = patchEntityAndCheck(entity, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Update description with a new description and the version changes as admin - the changes are
    json = JsonUtils.pojoToJson(entity);
    entity.setDescription("description2");
    change = getChangeDescription(entity, MINOR_UPDATE); // Version changes
    fieldUpdated(change, "description", "description1", "description2");
    entity = patchEntityAndCheck(entity, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Update displayName with a new displayName - but as USER1
    // Since the previous change is done by a different user, changes ** are not ** consolidated
    json = JsonUtils.pojoToJson(entity);
    entity.setDisplayName("displayName");
    change = getChangeDescription(entity, MINOR_UPDATE); // Version changes
    fieldAdded(change, "displayName", "displayName");
    entity = patchEntityAndCheck(entity, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Update displayName to a new displayName.
    // In this test, the user who previously made a change makes the change after session timeout.
    // The changes are not consolidated.
    EntityUpdater.setSessionTimeout(1); // Reduce the session timeout for this test
    java.lang.Thread.sleep(2);
    json = JsonUtils.pojoToJson(entity);
    entity.setDisplayName("displayName1");
    change = getChangeDescription(entity, MINOR_UPDATE); // Version changes
    fieldUpdated(change, "displayName", "displayName", "displayName1");
    patchEntityAndCheck(entity, json, authHeaders(USER1.getName()), MINOR_UPDATE, change);
    EntityUpdater.setSessionTimeout(10 * 60 * 10000); // Reset the session timeout back
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void patch_etag_in_get_response(TestInfo test) throws IOException {
    if (!supportsPatch || !supportsEtag) {
      return;
    }

    // Create a test entity
    T entity = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);

    // Get the entity and check for ETag header
    WebTarget target = getResource(entity.getId());
    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();

    assertEquals(OK.getStatusCode(), response.getStatus());

    // Check if ETag header is present
    String etag = response.getHeaderString(EntityETag.ETAG_HEADER);
    assertNotNull(etag, "ETag header should be present in GET response");
    assertTrue(etag.startsWith("\"") && etag.endsWith("\""), "ETag should be wrapped in quotes");

    T returnedEntity = response.readEntity(entityClass);

    // Verify ETag format includes version and timestamp
    // Remove any compression suffixes (e.g., "--gzip") from the ETag for comparison
    String cleanEtag = etag.replaceAll("--\\w+\"$", "\"");
    String expectedETag = EntityETag.generateETag(returnedEntity);
    assertEquals(
        expectedETag,
        cleanEtag,
        "Generated ETag should match response ETag (ignoring compression suffix)");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void patch_with_valid_etag(TestInfo test) throws IOException {
    if (!supportsPatch || !supportsEtag) {
      return;
    }

    // Create a test entity
    T entity = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);

    // Get the entity with ETag
    WebTarget getTarget = getResource(entity.getId());
    Response getResponse = SecurityUtil.addHeaders(getTarget, ADMIN_AUTH_HEADERS).get();
    String etag = getResponse.getHeaderString(EntityETag.ETAG_HEADER);
    T originalEntity = getResponse.readEntity(entityClass);

    // Prepare patch to update description
    String originalJson = JsonUtils.pojoToJson(originalEntity);
    originalEntity.setDescription("Updated description with ETag");
    String updatedJson = JsonUtils.pojoToJson(originalEntity);
    JsonNode patch =
        JsonDiff.asJson(
            JsonUtils.getObjectMapper().readTree(originalJson),
            JsonUtils.getObjectMapper().readTree(updatedJson));

    // PATCH with valid ETag in If-Match header
    WebTarget patchTarget = getResource(entity.getId());
    Map<String, String> headers = new HashMap<>(ADMIN_AUTH_HEADERS);
    headers.put(EntityETag.IF_MATCH_HEADER, etag);

    Response patchResponse =
        SecurityUtil.addHeaders(patchTarget, headers)
            .method(
                "PATCH",
                jakarta.ws.rs.client.Entity.entity(
                    patch.toString(), MediaType.APPLICATION_JSON_PATCH_JSON_TYPE));

    assertEquals(
        OK.getStatusCode(), patchResponse.getStatus(), "PATCH with valid ETag should succeed");

    // Verify response has new ETag
    String newETag = patchResponse.getHeaderString(EntityETag.ETAG_HEADER);
    assertNotNull(newETag, "Response should include new ETag");
    assertNotEquals(etag, newETag, "ETag should change after update");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void patch_with_stale_etag(TestInfo test) throws IOException {
    if (!supportsPatch || !supportsEtag) {
      return;
    }

    // Create a test entity
    T entity = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);

    // Get the entity with ETag
    WebTarget getTarget = getResource(entity.getId());
    Response getResponse = SecurityUtil.addHeaders(getTarget, ADMIN_AUTH_HEADERS).get();
    String originalETag = getResponse.getHeaderString(EntityETag.ETAG_HEADER);
    T originalEntity = getResponse.readEntity(entityClass);

    // First update to change the ETag
    String originalJson = JsonUtils.pojoToJson(originalEntity);
    originalEntity.setDescription("First update");
    patchEntity(entity.getId(), originalJson, originalEntity, ADMIN_AUTH_HEADERS);

    // Try to patch with the stale ETag
    originalEntity.setDescription("Second update with stale ETag");
    String updatedJson = JsonUtils.pojoToJson(originalEntity);
    JsonNode patch =
        JsonDiff.asJson(
            JsonUtils.getObjectMapper().readTree(originalJson),
            JsonUtils.getObjectMapper().readTree(updatedJson));

    // PATCH with stale ETag
    WebTarget patchTarget = getResource(entity.getId());
    Map<String, String> headers = new HashMap<>(ADMIN_AUTH_HEADERS);
    headers.put(EntityETag.IF_MATCH_HEADER, originalETag);

    Response patchResponse =
        SecurityUtil.addHeaders(patchTarget, headers)
            .method(
                "PATCH",
                jakarta.ws.rs.client.Entity.entity(
                    patch.toString(), MediaType.APPLICATION_JSON_PATCH_JSON_TYPE));

    // Should return 412 Precondition Failed if ETag validation is enabled
    // For backward compatibility, it might still return 200 if validation is disabled
    int status = patchResponse.getStatus();
    assertTrue(
        status == OK.getStatusCode() || status == PRECONDITION_FAILED.getStatusCode(),
        "PATCH with stale ETag should either succeed (if validation disabled) or return 412");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void patch_concurrent_updates_with_etag(TestInfo test) throws Exception {
    if (!supportsPatch || !supportsEtag) {
      return;
    }

    // Create a test entity
    T entity = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);

    // Get the entity with ETag
    WebTarget getTarget = getResource(entity.getId());
    Response getResponse = SecurityUtil.addHeaders(getTarget, ADMIN_AUTH_HEADERS).get();
    String etag = getResponse.getHeaderString(EntityETag.ETAG_HEADER);
    T originalEntity = getResponse.readEntity(entityClass);

    // Prepare for concurrent updates
    ExecutorService executorService = Executors.newFixedThreadPool(2);
    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch completionLatch = new CountDownLatch(2);
    AtomicReference<Response> response1 = new AtomicReference<>();
    AtomicReference<Response> response2 = new AtomicReference<>();
    AtomicReference<Exception> error = new AtomicReference<>();

    // Task 1: Update description
    executorService.submit(
        () -> {
          try {
            startLatch.await();

            String originalJson = JsonUtils.pojoToJson(originalEntity);
            T updated = JsonUtils.readValue(originalJson, entityClass);
            updated.setDescription("Concurrent update 1");
            String updatedJson = JsonUtils.pojoToJson(updated);
            JsonNode patch =
                JsonDiff.asJson(
                    JsonUtils.getObjectMapper().readTree(originalJson),
                    JsonUtils.getObjectMapper().readTree(updatedJson));

            WebTarget patchTarget = getResource(entity.getId());
            Map<String, String> headers = new HashMap<>(ADMIN_AUTH_HEADERS);
            headers.put(EntityETag.IF_MATCH_HEADER, etag);

            Response response =
                SecurityUtil.addHeaders(patchTarget, headers)
                    .method(
                        "PATCH",
                        jakarta.ws.rs.client.Entity.entity(
                            patch.toString(), MediaType.APPLICATION_JSON_PATCH_JSON_TYPE));
            response1.set(response);

          } catch (Exception e) {
            error.compareAndSet(null, e);
          } finally {
            completionLatch.countDown();
          }
        });

    // Task 2: Update displayName
    executorService.submit(
        () -> {
          try {
            startLatch.await();

            String originalJson = JsonUtils.pojoToJson(originalEntity);
            T updated = JsonUtils.readValue(originalJson, entityClass);
            updated.setDisplayName("Concurrent Display Name");
            String updatedJson = JsonUtils.pojoToJson(updated);
            JsonNode patch =
                JsonDiff.asJson(
                    JsonUtils.getObjectMapper().readTree(originalJson),
                    JsonUtils.getObjectMapper().readTree(updatedJson));

            WebTarget patchTarget = getResource(entity.getId());
            Map<String, String> headers = new HashMap<>(ADMIN_AUTH_HEADERS);
            headers.put(EntityETag.IF_MATCH_HEADER, etag);

            Response response =
                SecurityUtil.addHeaders(patchTarget, headers)
                    .method(
                        "PATCH",
                        jakarta.ws.rs.client.Entity.entity(
                            patch.toString(), MediaType.APPLICATION_JSON_PATCH_JSON_TYPE));
            response2.set(response);

          } catch (Exception e) {
            error.compareAndSet(null, e);
          } finally {
            completionLatch.countDown();
          }
        });

    // Start both tasks simultaneously
    startLatch.countDown();

    // Wait for completion
    assertTrue(completionLatch.await(30, TimeUnit.SECONDS), "Tasks should complete within timeout");
    executorService.shutdown();

    // Check results
    if (error.get() != null) {
      throw new RuntimeException("Error in concurrent update", error.get());
    }

    int status1 = response1.get().getStatus();
    int status2 = response2.get().getStatus();

    // With ETag validation, at least one should fail with 412 or both succeed due to timing
    LOG.info("Concurrent update with ETag - status 1: {}, status 2: {}", status1, status2);

    // If ETag validation is enabled, one should fail
    // If disabled, both might succeed
    assertTrue(
        (status1 == OK.getStatusCode() && status2 == OK.getStatusCode())
            || // Both succeed (no validation)
            (status1 == OK.getStatusCode() && status2 == PRECONDITION_FAILED.getStatusCode())
            || // First succeeds
            (status1 == PRECONDITION_FAILED.getStatusCode()
                && status2 == OK.getStatusCode()), // Second succeeds
        "One update should succeed and other should fail with 412, or both succeed if validation disabled");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void patch_concurrentUpdates_dataLossTest(TestInfo test) throws Exception {
    if (!supportsPatch || !supportsEtag) {
      return;
    }

    // Store original session timeout and set a short one to avoid consolidation
    long originalTimeout = EntityRepository.EntityUpdater.getSessionTimeout();
    EntityRepository.EntityUpdater.setSessionTimeout(10); // 10ms timeout

    try {
      // Create initial entity
      K createRequest = createRequest(test);
      T entity = createAndCheckEntity(createRequest, ADMIN_AUTH_HEADERS);

      // Set up for concurrent updates
      int numThreads = 2;
      CountDownLatch startLatch = new CountDownLatch(1);
      CountDownLatch completionLatch = new CountDownLatch(numThreads);
      AtomicReference<T> entityAfterUpdate1 = new AtomicReference<>();
      AtomicReference<T> entityAfterUpdate2 = new AtomicReference<>();
      AtomicReference<Exception> errorRef = new AtomicReference<>();
      AtomicInteger retryCount = new AtomicInteger(0);

      // Thread 1: Update description with ETag and retry logic
      java.lang.Thread thread1 =
          new java.lang.Thread(
              () -> {
                try {
                  startLatch.await();

                  boolean updated = false;
                  int attempts = 0;
                  while (!updated && attempts < 3) {
                    attempts++;

                    // Get fresh copy of entity with ETag
                    WebTarget target = getResource(entity.getId());
                    Response getResponse =
                        SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();
                    T currentEntity = getResponse.readEntity(entityClass);
                    String etag = getResponse.getHeaderString("ETag");
                    // Remove compression suffix if present (e.g., "--gzip")
                    if (etag != null && etag.contains("--")) {
                      etag = etag.substring(0, etag.indexOf("--")) + "\"";
                    }
                    String originalJson = JsonUtils.pojoToJson(currentEntity);

                    // Update description
                    currentEntity.setDescription("Updated by thread 1 - new description");

                    // Simulate processing delay
                    java.lang.Thread.sleep(100);

                    // Patch the entity with ETag
                    try {
                      String updatedJson = JsonUtils.pojoToJson(currentEntity);
                      JsonNode patch =
                          JsonDiff.asJson(
                              JsonUtils.getObjectMapper().readTree(originalJson),
                              JsonUtils.getObjectMapper().readTree(updatedJson));

                      T result =
                          TestUtils.patch(
                              getResource(entity.getId()),
                              patch,
                              entityClass,
                              ADMIN_AUTH_HEADERS,
                              etag);
                      entityAfterUpdate1.set(result);
                      updated = true;
                    } catch (HttpResponseException e) {
                      if (e.getStatusCode() == 412) { // Precondition Failed - ETag mismatch
                        retryCount.incrementAndGet();
                        LOG.info("Thread 1 got 412, retrying... (attempt {})", attempts);
                        // Will retry with fresh data in next iteration
                      } else {
                        throw e;
                      }
                    }
                  }

                  if (!updated) {
                    fail("Thread 1 failed to update after 3 attempts");
                  }

                } catch (Exception e) {
                  errorRef.compareAndSet(null, e);
                } finally {
                  completionLatch.countDown();
                }
              });

      // Thread 2: Add tags (if supported) or update displayName with ETag and retry logic
      java.lang.Thread thread2 =
          new java.lang.Thread(
              () -> {
                try {
                  startLatch.await();

                  boolean updated = false;
                  int attempts = 0;
                  while (!updated && attempts < 3) {
                    attempts++;

                    // Get fresh copy of entity with ETag
                    WebTarget target = getResource(entity.getId());
                    Response getResponse =
                        SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();
                    T currentEntity = getResponse.readEntity(entityClass);
                    String etag = getResponse.getHeaderString("ETag");
                    // Remove compression suffix if present (e.g., "--gzip")
                    if (etag != null && etag.contains("--")) {
                      etag = etag.substring(0, etag.indexOf("--")) + "\"";
                    }
                    String originalJson = JsonUtils.pojoToJson(currentEntity);

                    // Add tags or update displayName
                    if (supportsTags && currentEntity instanceof EntityInterface) {
                      EntityInterface entityInterface = (EntityInterface) currentEntity;
                      List<TagLabel> tags = new ArrayList<>();
                      tags.add(TIER1_TAG_LABEL);
                      tags.add(USER_ADDRESS_TAG_LABEL);
                      entityInterface.setTags(tags);
                    } else {
                      currentEntity.setDisplayName("Updated by thread 2");
                    }

                    // Simulate processing delay
                    java.lang.Thread.sleep(150);

                    // Patch the entity with ETag
                    try {
                      String updatedJson = JsonUtils.pojoToJson(currentEntity);
                      JsonNode patch =
                          JsonDiff.asJson(
                              JsonUtils.getObjectMapper().readTree(originalJson),
                              JsonUtils.getObjectMapper().readTree(updatedJson));

                      T result =
                          TestUtils.patch(
                              getResource(entity.getId()),
                              patch,
                              entityClass,
                              ADMIN_AUTH_HEADERS,
                              etag);
                      entityAfterUpdate2.set(result);
                      updated = true;
                    } catch (HttpResponseException e) {
                      if (e.getStatusCode() == 412) { // Precondition Failed - ETag mismatch
                        retryCount.incrementAndGet();
                        LOG.info("Thread 2 got 412, retrying... (attempt {})", attempts);
                        // Will retry with fresh data in next iteration
                      } else {
                        throw e;
                      }
                    }
                  }

                  if (!updated) {
                    fail("Thread 2 failed to update after 3 attempts");
                  }

                } catch (Exception e) {
                  errorRef.compareAndSet(null, e);
                } finally {
                  completionLatch.countDown();
                }
              });

      // Start both threads
      thread1.start();
      thread2.start();

      // Release both threads to run concurrently
      startLatch.countDown();

      // Add a small delay to ensure threads fetch at slightly different times
      // This increases the chance of one thread getting a stale ETag
      java.lang.Thread.sleep(50);

      // Wait for completion
      assertTrue(
          completionLatch.await(30, TimeUnit.SECONDS), "Threads should complete within timeout");

      // Check for errors
      if (errorRef.get() != null) {
        throw new AssertionError("Thread execution failed", errorRef.get());
      }

      // Get final entity state
      T finalEntity = getEntity(entity.getId(), allFields, ADMIN_AUTH_HEADERS);

      // Verify both updates were applied (this should fail if there's a concurrency issue)
      // The issue is that when both threads start with the same version, the second update
      // might overwrite the first update's changes

      // Check description from thread 1
      assertEquals(
          "Updated by thread 1 - new description",
          finalEntity.getDescription(),
          "Description update from thread 1 should be preserved");

      // Check tags/displayName from thread 2
      if (supportsTags) {
        List<TagLabel> finalTags = finalEntity.getTags();
        assertNotNull(finalTags, "Tags should not be null after thread 2 update");
        assertEquals(2, finalTags.size(), "Should have 2 tags from thread 2");
        assertTrue(
            finalTags.stream().anyMatch(tag -> tag.getTagFQN().equals(TIER1_TAG_LABEL.getTagFQN())),
            "Should have Tier1 tag from thread 2");
        assertTrue(
            finalTags.stream()
                .anyMatch(tag -> tag.getTagFQN().equals(USER_ADDRESS_TAG_LABEL.getTagFQN())),
            "Should have User.Address tag from thread 2");
      } else {
        assertEquals(
            "Updated by thread 2",
            finalEntity.getDisplayName(),
            "DisplayName update from thread 2 should be preserved");
      }

      // Verify version increments
      assertTrue(
          finalEntity.getVersion() > entity.getVersion(),
          "Version should be incremented after updates");

      // Both updates should result in version increments
      // If concurrency is handled properly, we should see version increments for both updates
      assertNotNull(entityAfterUpdate1.get(), "Thread 1 should have completed update");
      assertNotNull(entityAfterUpdate2.get(), "Thread 2 should have completed update");

      // Verify retry occurred (at least one thread should have retried due to concurrent update)
      assertTrue(
          retryCount.get() > 0, "At least one thread should have retried due to ETag mismatch");

      // Log versions for debugging
      LOG.info("Concurrent update test completed successfully with {} retries", retryCount.get());
      LOG.info(
          "Initial version: {}, Thread1 version: {}, Thread2 version: {}, Final version: {}",
          entity.getVersion(),
          entityAfterUpdate1.get().getVersion(),
          entityAfterUpdate2.get().getVersion(),
          finalEntity.getVersion());
    } finally {
      // Restore original session timeout
      EntityRepository.EntityUpdater.setSessionTimeout(originalTimeout);
    }
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void put_addEntityCustomAttributes(TestInfo test) throws IOException {
    if (!supportsCustomExtension) {
      return;
    }

    // PUT valid custom field intA to the entity type
    TypeResourceTest typeResourceTest = new TypeResourceTest();
    Type entityType =
        typeResourceTest.getEntityByName(this.entityType, "customProperties", ADMIN_AUTH_HEADERS);
    CustomProperty fieldA =
        new CustomProperty()
            .withName("intA")
            .withDescription("intA")
            .withPropertyType(INT_TYPE.getEntityReference());
    entityType =
        typeResourceTest.addAndCheckCustomProperty(
            entityType.getId(), fieldA, OK, ADMIN_AUTH_HEADERS);
    final UUID id = entityType.getId();

    // PATCH valid custom field stringB
    CustomProperty fieldB =
        new CustomProperty()
            .withName("stringB")
            .withDescription("stringB")
            .withPropertyType(STRING_TYPE.getEntityReference());

    String json = JsonUtils.pojoToJson(entityType);
    ChangeDescription change =
        getChangeDescription(entityType, MINOR_UPDATE); // Patch operation update is

    fieldAdded(change, "customProperties", CommonUtil.listOf(fieldB));
    entityType.getCustomProperties().add(fieldB);
    entityType =
        typeResourceTest.patchEntityAndCheck(
            entityType, json, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // PUT invalid custom fields to the entity - custom field has invalid type
    Type invalidType =
        new Type()
            .withId(UUID.randomUUID())
            .withName("invalid")
            .withCategory(Category.Field)
            .withSchema("{}");
    CustomProperty fieldInvalid =
        new CustomProperty()
            .withName("invalid")
            .withDescription("invalid")
            .withPropertyType(invalidType.getEntityReference());
    assertResponse(
        () -> typeResourceTest.addCustomProperty(id, fieldInvalid, OK, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(Entity.TYPE, invalidType.getId()));

    // PATCH invalid custom fields to the entity - custom field has invalid type
    String json1 = JsonUtils.pojoToJson(entityType);
    entityType.getCustomProperties().add(fieldInvalid);
    Type finalEntity = entityType;
    assertResponse(
        () -> typeResourceTest.patchEntity(id, json1, finalEntity, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(Entity.TYPE, invalidType.getName()));

    // Now POST an entity with extension that includes custom field intA
    ObjectMapper mapper = new ObjectMapper();
    ObjectNode jsonNode = mapper.createObjectNode();
    jsonNode.set("intA", mapper.convertValue(1, JsonNode.class));
    K create = createRequest(test).withExtension(jsonNode);
    T entity = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // PUT and update the entity with extension field intA to a new value
    JsonNode intAValue = mapper.convertValue(2, JsonNode.class);
    jsonNode.set("intA", intAValue);
    create = createRequest(test).withExtension(jsonNode).withName(entity.getName());
    change = getChangeDescription(entity, MINOR_UPDATE);
    fieldUpdated(
        change,
        EntityUtil.getExtensionField("intA"),
        mapper.convertValue(1, JsonNode.class),
        intAValue);
    entity = updateAndCheckEntity(create, Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // PATCH and update the entity with extension field stringB
    json = JsonUtils.pojoToJson(entity);
    JsonNode stringBValue = mapper.convertValue("stringB", JsonNode.class);
    jsonNode.set("stringB", stringBValue);
    entity.setExtension(jsonNode);
    change = getChangeDescription(entity, getChangeType()); // PATCH operation update is not
    fieldAdded(change, "extension", List.of(JsonUtils.getObjectNode("stringB", stringBValue)));
    entity = patchEntityAndCheck(entity, json, ADMIN_AUTH_HEADERS, getChangeType(), change);
    assertEquals(JsonUtils.valueToTree(jsonNode), JsonUtils.valueToTree(entity.getExtension()));

    // PUT and remove field intA from the entity extension - *** for BOT this should be ignored ***
    JsonNode oldNode = JsonUtils.valueToTree(entity.getExtension());
    jsonNode.remove("intA");
    create = createRequest(test).withExtension(jsonNode).withName(entity.getName());
    entity = updateEntity(create, Status.OK, INGESTION_BOT_AUTH_HEADERS);
    assertNotEquals(
        JsonUtils.valueToTree(create.getExtension()), JsonUtils.valueToTree(entity.getExtension()));
    assertEquals(oldNode, JsonUtils.valueToTree(entity.getExtension())); // Extension remains as is

    // PUT and remove field intA from the entity extension (for non-bot this should succeed)
    change =
        getChangeDescription(
            entity, MINOR_UPDATE); // PUT operation update is not consolidated in a session
    fieldDeleted(change, "extension", List.of(JsonUtils.getObjectNode("intA", intAValue)));
    entity = updateAndCheckEntity(create, Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertEquals(
        JsonUtils.valueToTree(create.getExtension()), JsonUtils.valueToTree(entity.getExtension()));
    json = JsonUtils.pojoToJson(entity);
    jsonNode.remove("stringB");
    entity.setExtension(jsonNode);
    change =
        getChangeDescription(
            entity, MINOR_UPDATE); // PATCH operation update is consolidated into a session
    fieldDeleted(change, "extension", List.of(JsonUtils.getObjectNode("stringB", stringBValue)));
    entity = patchEntityAndCheck(entity, json, ADMIN_AUTH_HEADERS, getChangeType(), change);
    if (!JsonUtils.valueToTree(jsonNode).isEmpty()
        && !JsonUtils.valueToTree(entity.getExtension()).isEmpty()) {
      assertEquals(JsonUtils.valueToTree(jsonNode), JsonUtils.valueToTree(entity.getExtension()));
    }

    // Now set the entity custom property to an invalid value
    jsonNode.set(
        "intA",
        mapper.convertValue("stringInsteadOfNumber", JsonNode.class)); // String in integer field
    assertResponseContains(
        () -> createEntity(createRequest(test, 1).withExtension(jsonNode), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.jsonValidationError("intA", ""));

    // Now set the entity custom property with an unknown field name
    jsonNode.remove("intA");
    jsonNode.set("stringC", mapper.convertValue("string", JsonNode.class)); // Unknown field
    assertResponse(
        () -> createEntity(createRequest(test, 1).withExtension(jsonNode), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.unknownCustomField("stringC"));
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////
  // Common entity tests for DELETE operations
  //////////////////////////////////////////////////////////////////////////////////////////////////
  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void delete_nonExistentEntity_404() {
    assertResponse(
        () -> deleteEntity(NON_EXISTENT_ENTITY, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(entityType, NON_EXISTENT_ENTITY));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  protected void delete_entity_as_non_admin_401(TestInfo test) throws HttpResponseException {
    if (supportsAdminOnly) {
      return;
    }
    // Deleting as non-owner and non-admin should fail
    K request = createRequest(getEntityName(test), "", "", null);
    T entity = createEntity(request, ADMIN_AUTH_HEADERS);
    assertResponse(
        () -> deleteAndCheckEntity(entity, TEST_AUTH_HEADERS),
        FORBIDDEN,
        permissionNotAllowed(TEST_USER_NAME, List.of(MetadataOperation.DELETE)));

    assertResponse(
        () -> deleteByNameAndCheckEntity(entity, true, true, TEST_AUTH_HEADERS),
        FORBIDDEN,
        permissionNotAllowed(TEST_USER_NAME, List.of(MetadataOperation.DELETE)));
  }

  /**
   * Soft delete an entity and then use restore request to restore it back
   */
  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void delete_restore_entity_200(TestInfo test) throws IOException {
    K request = createRequest(getEntityName(test), "", "", null);
    T entity = createEntity(request, ADMIN_AUTH_HEADERS);

    entity = deleteAndCheckEntity(entity, ADMIN_AUTH_HEADERS);

    // Entity is soft deleted
    if (supportsSoftDelete) {
      // Send PUT request (with no changes) to restore the entity from soft deleted state
      ChangeDescription change = getChangeDescription(entity, MINOR_UPDATE);
      fieldUpdated(change, FIELD_DELETED, true, false);
      restoreAndCheckEntity(entity, ADMIN_AUTH_HEADERS, change);
    } else {
      assertEntityDeleted(entity, true);
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////
  // Common entity tests for ASYNC DELETE operations
  //////////////////////////////////////////////////////////////////////////////////////////////////

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void delete_async_nonExistentEntity_404() {
    assertResponse(
        () -> deleteEntityAsync(NON_EXISTENT_ENTITY, false, false, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(entityType, NON_EXISTENT_ENTITY));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void delete_async_entity_as_non_admin_401(TestInfo test) throws HttpResponseException {
    if (supportsEmptyDescription) {
      return;
    }
    // Create entity as admin
    K request = createRequest(getEntityName(test), "", "", null);
    T entity = createEntity(request, ADMIN_AUTH_HEADERS);

    // Attempt to delete async as non-admin should fail
    assertResponse(
        () -> deleteEntityAsync(entity.getId(), false, false, TEST_AUTH_HEADERS),
        FORBIDDEN,
        permissionNotAllowed(TEST_USER_NAME, List.of(MetadataOperation.DELETE)));
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  public void delete_async_with_recursive_hardDelete(TestInfo test) throws Exception {
    K request = createRequest(getEntityName(test), "", "", null);
    T entity = createEntity(request, ADMIN_AUTH_HEADERS);

    // Test async delete with recursive and hard delete flags
    DeleteEntityMessage deleteMessage = receiveDeleteEntityMessage(entity.getId(), true, true);

    assertEquals("COMPLETED", deleteMessage.getStatus());
    assertEquals(entity.getName(), deleteMessage.getEntityName());
    assertNull(deleteMessage.getError());
    assertEntityDeleted(entity.getId(), true);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void delete_async_soft_delete(TestInfo test) throws Exception {
    if (!supportsSoftDelete) {
      return;
    }

    K request = createRequest(getEntityName(test), "", "", null);
    T entity = createEntity(request, ADMIN_AUTH_HEADERS);

    // Test async soft delete
    DeleteEntityMessage deleteMessage = receiveDeleteEntityMessage(entity.getId(), false, false);

    assertEquals("COMPLETED", deleteMessage.getStatus());
    assertEquals(entity.getName(), deleteMessage.getEntityName());
    assertNull(deleteMessage.getError());
    assertEntityDeleted(entity.getId(), false);
  }

  protected DeleteEntityMessage receiveDeleteEntityMessage(
      UUID id, boolean recursive, boolean hardDelete) throws Exception {
    UUID userId = getAdminUserId();
    String uri = String.format("http://localhost:%d", APP.getLocalPort());

    IO.Options options = new IO.Options();
    options.path = "/api/v1/push/feed";
    options.query = "userId=" + userId.toString();
    options.transports = new String[] {"websocket"};
    options.reconnection = false;
    options.timeout = 10000; // 10 seconds

    Socket socket = IO.socket(uri, options);

    CountDownLatch connectLatch = new CountDownLatch(1);
    CountDownLatch messageLatch = new CountDownLatch(1);
    final String[] receivedMessage = new String[1];

    socket
        .on(
            Socket.EVENT_CONNECT,
            args -> {
              LOG.info("Connected to Socket.IO server");
              connectLatch.countDown();
            })
        .on(
            WebSocketManager.DELETE_ENTITY_CHANNEL,
            args -> {
              receivedMessage[0] = (String) args[0];
              LOG.info("Received delete message: " + receivedMessage[0]);
              messageLatch.countDown();
              socket.disconnect();
            })
        .on(
            Socket.EVENT_CONNECT_ERROR,
            args -> {
              LOG.error("Socket.IO connect error: " + args[0]);
              connectLatch.countDown();
              messageLatch.countDown();
            })
        .on(Socket.EVENT_DISCONNECT, args -> LOG.info("Disconnected from Socket.IO server"));

    socket.connect();
    if (!connectLatch.await(10, TimeUnit.SECONDS)) {
      fail("Could not connect to Socket.IO server");
    }

    // Initiate the delete operation after connection is established
    Response response = deleteEntityAsync(id, recursive, hardDelete, ADMIN_AUTH_HEADERS);
    assertEquals(Status.ACCEPTED.getStatusCode(), response.getStatus());

    // Validate initial response
    DeleteEntityResponse deleteResponse = response.readEntity(DeleteEntityResponse.class);
    assertNotNull(deleteResponse.getJobId());
    assertEquals(
        "Delete operation initiated for " + deleteResponse.getEntityName(),
        deleteResponse.getMessage());
    assertEquals(hardDelete, deleteResponse.isHardDelete());

    if (!messageLatch.await(30, TimeUnit.SECONDS)) {
      fail("Did not receive delete notification via Socket.IO within the expected time.");
    }

    String receivedJson = receivedMessage[0];
    if (receivedJson == null) {
      fail("Received message is null.");
    }

    DeleteEntityMessage deleteMessage =
        JsonUtils.readValue(receivedJson, DeleteEntityMessage.class);
    if ("FAILED".equals(deleteMessage.getStatus())) {
      fail("Delete operation failed: " + deleteMessage.getError());
    }

    return deleteMessage;
  }

  protected Response deleteEntityAsync(
      UUID id, boolean recursive, boolean hardDelete, Map<String, String> authHeaders)
      throws HttpResponseException {
    try {
      WebTarget target = getCollection().path(String.format("async/%s", id));
      target = target.queryParam("recursive", recursive).queryParam("hardDelete", hardDelete);
      LOG.info("Deleting entity with id {}, target:{}", id, target);
      return TestUtils.deleteAsync(target, authHeaders);
    } catch (HttpResponseException e) {
      LOG.error("Failed to delete entity with id {}: {}", id, e.getMessage());
      throw e;
    }
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////
  // Other tests
  //////////////////////////////////////////////////////////////////////////////////////////////////
  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void testInvalidEntityList() {
    // Invalid entityCreated list
    assertResponse(
        () ->
            getChangeEvents(
                "invalidEntity",
                entityType,
                null,
                null,
                System.currentTimeMillis(),
                ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Invalid entity invalidEntity in query param entityCreated");

    // Invalid entityUpdated list
    assertResponse(
        () ->
            getChangeEvents(
                null,
                "invalidEntity",
                null,
                entityType,
                System.currentTimeMillis(),
                ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Invalid entity invalidEntity in query param entityUpdated");

    // Invalid entityDeleted list
    assertResponse(
        () ->
            getChangeEvents(
                entityType,
                null,
                null,
                "invalidEntity",
                System.currentTimeMillis(),
                ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Invalid entity invalidEntity in query param entityDeleted");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void delete_systemEntity() throws IOException {
    if (systemEntityName == null) {
      return;
    }
    T systemEntity = getEntityByName(systemEntityName, "", ADMIN_AUTH_HEADERS);
    assertResponse(
        () -> deleteEntity(systemEntity.getId(), true, true, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.systemEntityDeleteNotAllowed(systemEntity.getName(), entityType));
  }

  @Test
  protected void checkIndexCreated() throws IOException, JSONException {
    RestClient client = getSearchClient();
    Request request = new Request("GET", "/_cat/indices");
    request.addParameter("format", "json");
    es.org.elasticsearch.client.Response response = client.performRequest(request);
    JSONArray jsonArray = new JSONArray(EntityUtils.toString(response.getEntity()));
    List<String> indexNamesFromResponse = new ArrayList<>();
    for (int i = 0; i < jsonArray.length(); i++) {
      JSONObject jsonObject = jsonArray.getJSONObject(i);
      String indexName = jsonObject.getString("index");
      indexNamesFromResponse.add(indexName);
    }
    client.close();
  }

  @Test
  protected void checkCreatedEntity(TestInfo test) throws IOException {
    Assumptions.assumeTrue(supportsSearchIndex);
    // create entity
    T entity = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    EntityReference entityReference = getEntityReference(entity);

    // Wait for entity to be indexed in Elasticsearch
    waitForSyncAndGetFromSearchIndex(
        entity.getUpdatedAt(), entity.getId(), entityReference.getType());

    IndexMapping indexMapping =
        Entity.getSearchRepository().getIndexMapping(entityReference.getType());
    // search api method internally appends clusterAlias name
    SearchResponse response = getResponseFormSearch(indexMapping.getIndexName(null));
    List<String> entityIds = new ArrayList<>();
    SearchHit[] hits = response.getHits().getHits();
    for (SearchHit hit : hits) {
      Map<String, Object> sourceAsMap = hit.getSourceAsMap();
      entityIds.add(sourceAsMap.get("id").toString());
    }
    // verify is it present in search
    assertTrue(entityIds.contains(entity.getId().toString()));
  }

  @Test
  protected void checkDeletedEntity(TestInfo test) throws HttpResponseException {
    Assumptions.assumeTrue(supportsSearchIndex);
    // create entity
    T entity = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    EntityReference entityReference = getEntityReference(entity);

    // Wait for entity to be indexed in Elasticsearch
    waitForSyncAndGetFromSearchIndex(
        entity.getUpdatedAt(), entity.getId(), entityReference.getType());

    IndexMapping indexMapping =
        Entity.getSearchRepository().getIndexMapping(entityReference.getType());
    // search api method internally appends clusterAlias name
    SearchResponse response = getResponseFormSearch(indexMapping.getIndexName(null));
    List<String> entityIds = new ArrayList<>();
    SearchHit[] hits = response.getHits().getHits();
    for (SearchHit hit : hits) {
      Map<String, Object> sourceAsMap = hit.getSourceAsMap();
      entityIds.add(sourceAsMap.get("id").toString());
    }
    // verify is it present in search
    assertTrue(entityIds.contains(entity.getId().toString()));
    entityIds.clear();
    // delete entity
    WebTarget target = getResource(entity.getId());
    TestUtils.delete(target, entityClass, ADMIN_AUTH_HEADERS);

    // Wait for deletion to be reflected in Elasticsearch and verify
    // Use Awaitility to wait for the entity to be removed from search
    Awaitility.await("Wait for entity to be deleted from search index")
        .pollInterval(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(30))
        .until(
            () -> {
              SearchResponse deleteCheckResponse =
                  getResponseFormSearch(indexMapping.getIndexName(null));
              List<String> currentIds = new ArrayList<>();
              for (SearchHit hit : deleteCheckResponse.getHits().getHits()) {
                currentIds.add(hit.getSourceAsMap().get("id").toString());
              }
              return !currentIds.contains(entity.getId().toString());
            });
  }

  @Test
  protected void updateDescriptionAndCheckInSearch(TestInfo test) throws IOException {
    Assumptions.assumeTrue(supportsSearchIndex);
    T entity = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    EntityReference entityReference = getEntityReference(entity);
    String desc;
    String original = JsonUtils.pojoToJson(entity);
    entity.setDescription("update description");
    entity = patchEntity(entity.getId(), original, entity, ADMIN_AUTH_HEADERS);
    // check if description is updated in search as well
    Map<String, Object> sourceAsMap =
        waitForSyncAndGetFromSearchIndex(
            entity.getUpdatedAt(), entity.getId(), entityReference.getType());
    desc = sourceAsMap.get("description").toString();

    assertEquals(entity.getDescription(), desc);
  }

  @Test
  protected void deleteTagAndCheckRelationshipsInSearch(TestInfo test)
      throws HttpResponseException {
    Assumptions.assumeTrue(supportsSearchIndex && supportsTags);
    // create an entity
    T entity = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    EntityReference entityReference = getEntityReference(entity);
    IndexMapping indexMapping =
        Entity.getSearchRepository().getIndexMapping(entityReference.getType());
    String origJson = JsonUtils.pojoToJson(entity);
    TagResourceTest tagResourceTest = new TagResourceTest();
    Tag tag = tagResourceTest.createEntity(tagResourceTest.createRequest(test), ADMIN_AUTH_HEADERS);
    TagLabel tagLabel = EntityUtil.toTagLabel(tag);
    entity.setTags(new ArrayList<>());
    entity.getTags().add(tagLabel);
    // add tags to entity
    entity = patchEntity(entity.getId(), origJson, entity, ADMIN_AUTH_HEADERS);

    // Add retry logic to handle the eventual inconsistency state of the search index as it uses
    // async client.
    Map<String, Object> sourceAsMap =
        waitForSyncAndGetFromSearchIndex(
            entity.getUpdatedAt(), entity.getId(), entityReference.getType());
    List<String> fqnList =
        ((List<Map<String, String>>) sourceAsMap.get("tags"))
            .stream().map(tempMap -> tempMap.get("tagFQN")).toList();
    assertTrue(fqnList.contains(tagLabel.getTagFQN()));

    // delete the tag
    tagResourceTest.deleteEntity(tag.getId(), false, true, ADMIN_AUTH_HEADERS);

    Map<String, Object> sourceAsMapAfterDelete =
        waitForSyncAndGetFromSearchIndex(
            entity.getUpdatedAt(), entity.getId(), entityReference.getType());
    List<String> fqnListAfterDelete =
        ((List<Map<String, String>>) sourceAsMapAfterDelete.get("tags"))
            .stream().map(tempMap -> tempMap.get("tagFQN")).toList();
    // check if the added tag if also added in the entity in search
    assertFalse(fqnListAfterDelete.contains(tagLabel.getTagFQN()));
  }

  public static Map<String, Object> waitForSyncAndGetFromSearchIndex(
      Long entityDbLastUpdate, UUID entityId, String entityType) {
    AtomicReference<Map<String, Object>> responseMap = new AtomicReference<>();
    Awaitility.await("Wait for Indexes to be updated for the Entity")
        .ignoreExceptions()
        .pollInterval(Duration.ofMillis(2000L))
        .atMost(Duration.ofMillis(120 * 1000L)) // 60 iterations for 120 seconds
        .until(
            () -> {
              responseMap.set(getEntityDocumentFromSearch(entityId, entityType));
              Object esLastUpdateAt = responseMap.get().get("updatedAt");
              long esLastUpdate = Long.parseLong(esLastUpdateAt.toString());
              return esLastUpdate >= entityDbLastUpdate;
            });
    return responseMap.get();
  }

  public static Map<String, Object> getEntityDocumentFromSearch(UUID entityId, String entityType)
      throws HttpResponseException {
    IndexMapping indexMapping = Entity.getSearchRepository().getIndexMapping(entityType);
    // SearchResource.java-searchEntityInEsIndexWithId method internally appends clusterAlias name
    WebTarget target =
        getResource(
            String.format(
                "search/get/%s/doc/%s", indexMapping.getIndexName(null), entityId.toString()));
    String result = TestUtils.get(target, String.class, ADMIN_AUTH_HEADERS);
    GetResponse response = null;
    try {
      NamedXContentRegistry registry = new NamedXContentRegistry(getDefaultNamedXContents());
      XContentParser parser =
          JsonXContent.jsonXContent.createParser(
              registry, DeprecationHandler.IGNORE_DEPRECATIONS, result);
      response = GetResponse.fromXContent(parser);
    } catch (Exception e) {
      System.out.println("exception " + e);
    }
    return response.getSourceAsMap();
  }

  @Test
  void postPutPatch_entityLifeCycle(TestInfo test) throws IOException {
    if (!supportsLifeCycle) {
      return;
    }
    // Create an entity without lifeCycle
    T entity =
        createEntity(
            createRequest(getEntityName(test), "description", null, null), ADMIN_AUTH_HEADERS);

    // Add lifeCycle using PATCH request
    String json = JsonUtils.pojoToJson(entity);
    AccessDetails accessed =
        new AccessDetails().withTimestamp(1695059900L).withAccessedBy(USER2.getEntityReference());
    LifeCycle lifeCycle = new LifeCycle().withAccessed(accessed);
    entity = updateLifeCycle(json, entity, lifeCycle, lifeCycle);

    // Update lifeCycle using PATCH request
    AccessDetails created =
        new AccessDetails().withTimestamp(1695059500L).withAccessedBy(USER2.getEntityReference());
    json = JsonUtils.pojoToJson(entity);
    lifeCycle.withCreated(created);
    updateLifeCycle(json, entity, lifeCycle, lifeCycle);

    // Update lifeCycle
    AccessDetails updated =
        new AccessDetails().withTimestamp(1695059910L).withAccessedByAProcess("test");
    json = JsonUtils.pojoToJson(entity);
    lifeCycle.setUpdated(updated);
    updateLifeCycle(json, entity, lifeCycle, lifeCycle);

    // set createdAt to older time, this shouldn't be overriding
    json = JsonUtils.pojoToJson(entity);
    AccessDetails createdOld =
        new AccessDetails().withTimestamp(1695059400L).withAccessedByAProcess("test12");
    LifeCycle lifeCycle1 =
        new LifeCycle().withAccessed(accessed).withUpdated(updated).withCreated(createdOld);
    updateLifeCycle(json, entity, lifeCycle1, lifeCycle);
  }

  @Test
  void postPutPatch_entityCertification(TestInfo test) throws IOException {
    if (!supportsCertification) {
      return;
    }
    // Create an entity without lifeCycle
    T entity =
        createEntity(
            createRequest(getEntityName(test), "description", null, null), ADMIN_AUTH_HEADERS);

    // Create Tag
    TagResourceTest tagResourceTest = new TagResourceTest();
    Tag certificationTag =
        tagResourceTest.createEntity(tagResourceTest.createRequest(test, 0), ADMIN_AUTH_HEADERS);
    TagLabel certificationLabel = EntityUtil.toTagLabel(certificationTag);

    // Add certification using PATCH request
    String json = JsonUtils.pojoToJson(entity);
    AssetCertification certification = new AssetCertification().withTagLabel(certificationLabel);
    entity.setCertification(certification);
    try {
      patchEntity(entity.getId(), json, entity, ADMIN_AUTH_HEADERS);
      fail("Expected an exception to be thrown: Certification is not configured yet.");
    } catch (HttpResponseException e) {
      assertEquals(e.getStatusCode(), 400);
    }

    // Configure Certification Settings
    String[] fqnParts = FullyQualifiedName.split(certificationLabel.getTagFQN());
    String classification = FullyQualifiedName.getParentFQN(fqnParts);

    AssetCertificationSettings certificationSettings =
        new AssetCertificationSettings()
            .withAllowedClassification(classification)
            .withValidityPeriod("P30D");

    SystemRepository systemRepository = Entity.getSystemRepository();
    systemRepository.updateSetting(
        new Settings()
            .withConfigType(SettingsType.ASSET_CERTIFICATION_SETTINGS)
            .withConfigValue(certificationSettings));

    T patchedEntity = patchEntity(entity.getId(), json, entity, ADMIN_AUTH_HEADERS);
    assertEquals(
        patchedEntity.getCertification().getTagLabel().getTagFQN(), certificationLabel.getTagFQN());
    assertEquals(
        patchedEntity.getCertification().getAppliedDate(), System.currentTimeMillis(), 10 * 1000);
    assertEquals(
        (double)
            (patchedEntity.getCertification().getExpiryDate()
                - patchedEntity.getCertification().getAppliedDate()),
        30D * 24 * 60 * 60 * 1000,
        60 * 1000);

    // Create Second Tag
    Tag newCertificationTag =
        tagResourceTest.createEntity(tagResourceTest.createRequest(test, 1), ADMIN_AUTH_HEADERS);
    TagLabel newCertificationLabel = EntityUtil.toTagLabel(newCertificationTag);

    // Configure Certification Settings
    String[] newFqnParts = FullyQualifiedName.split(newCertificationLabel.getTagFQN());
    String newClassification = FullyQualifiedName.getParentFQN(newFqnParts);

    AssetCertificationSettings newCertificationSettings =
        new AssetCertificationSettings()
            .withAllowedClassification(newClassification)
            .withValidityPeriod("P60D");

    systemRepository.updateSetting(
        new Settings()
            .withConfigType(SettingsType.ASSET_CERTIFICATION_SETTINGS)
            .withConfigValue(newCertificationSettings));

    String newJson = JsonUtils.pojoToJson(entity);
    AssetCertification newCertification =
        new AssetCertification().withTagLabel(newCertificationLabel);
    entity.setCertification(newCertification);

    T newPatchedEntity = patchEntity(entity.getId(), newJson, entity, ADMIN_AUTH_HEADERS);
    assertEquals(
        newPatchedEntity.getCertification().getTagLabel().getTagFQN(),
        newCertificationLabel.getTagFQN());
    assertEquals(
        newPatchedEntity.getCertification().getAppliedDate(),
        System.currentTimeMillis(),
        10 * 1000);
    assertEquals(
        (double)
            (newPatchedEntity.getCertification().getExpiryDate()
                - newPatchedEntity.getCertification().getAppliedDate()),
        60D * 24 * 60 * 60 * 1000,
        10 * 1000);
  }

  private T updateLifeCycle(
      String json, T entity, LifeCycle newLifeCycle, LifeCycle expectedLifeCycle)
      throws HttpResponseException {
    entity.setLifeCycle(newLifeCycle);
    T patchEntity = patchEntity(entity.getId(), json, entity, ADMIN_AUTH_HEADERS);
    assertLifeCycle(expectedLifeCycle, patchEntity.getLifeCycle());
    T entity1 = getEntity(entity.getId(), "lifeCycle", ADMIN_AUTH_HEADERS);
    assertLifeCycle(expectedLifeCycle, entity1.getLifeCycle());
    return patchEntity;
  }

  private static List<NamedXContentRegistry.Entry> getDefaultNamedXContents() {
    Map<String, ContextParser<Object, ? extends Aggregation>> map = new HashMap<>();
    map.put(TopHitsAggregationBuilder.NAME, (p, c) -> ParsedTopHits.fromXContent(p, (String) c));
    map.put(StringTerms.NAME, (p, c) -> ParsedStringTerms.fromXContent(p, (String) c));
    return map.entrySet().stream()
        .map(
            entry ->
                new NamedXContentRegistry.Entry(
                    Aggregation.class, new ParseField(entry.getKey()), entry.getValue()))
        .collect(Collectors.toList());
  }

  private static SearchResponse getResponseFormSearch(String indexName)
      throws HttpResponseException {
    WebTarget target =
        getResource(
            String.format("search/query?q=&index=%s&from=0&deleted=false&size=1000", indexName));
    String result = TestUtils.get(target, String.class, ADMIN_AUTH_HEADERS);
    SearchResponse response = null;
    try {
      NamedXContentRegistry registry = new NamedXContentRegistry(getDefaultNamedXContents());
      XContentParser parser =
          JsonXContent.jsonXContent.createParser(
              registry, DeprecationHandler.IGNORE_DEPRECATIONS, result);
      response = SearchResponse.fromXContent(parser);
    } catch (Exception e) {
      System.out.println("exception " + e);
    }
    return response;
  }

  private static GetResponse getEntityFromSearchWithId(String indexName, UUID entityId)
      throws HttpResponseException {
    WebTarget target =
        getResource(String.format("search/get/%s/doc/%s", indexName, entityId.toString()));
    String result = TestUtils.get(target, String.class, ADMIN_AUTH_HEADERS);
    GetResponse response = null;
    try {
      NamedXContentRegistry registry = new NamedXContentRegistry(getDefaultNamedXContents());
      XContentParser parser =
          JsonXContent.jsonXContent.createParser(
              registry, DeprecationHandler.IGNORE_DEPRECATIONS, result);
      response = GetResponse.fromXContent(parser);
    } catch (Exception e) {
      System.out.println("exception " + e);
    }
    return response;
  }

  public static String getResponseFormSearchWithHierarchy(String indexName, String query)
      throws HttpResponseException {
    WebTarget target =
        getResource(
            String.format(
                "search/query?q=%s&index=%s&from=0&deleted=false&size=100&getHierarchy=true",
                query, indexName));
    return TestUtils.get(target, String.class, ADMIN_AUTH_HEADERS);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void test_cleanupConversations(TestInfo test) throws HttpResponseException {
    if (!Entity.supportsFeed(entityType)) {
      return;
    }
    K request = createRequest(getEntityName(test), "", "", null);
    T entity = createEntity(request, ADMIN_AUTH_HEADERS);

    // Add a conversation thread for the entity
    FeedResourceTest feedTest = new FeedResourceTest();
    String about = String.format("<#E::%s::%s>", entityType, entity.getFullyQualifiedName());
    CreateThread createThread =
        new CreateThread().withFrom(USER1.getName()).withMessage("message").withAbout(about);
    Thread thread = feedTest.createAndCheck(createThread, ADMIN_AUTH_HEADERS);

    // Add task thread for the entity from user1 to user2
    Thread taskThread =
        feedTest.createTaskThread(
            USER1.getName(),
            about,
            USER2.getEntityReference(),
            "old",
            "new",
            RequestDescription,
            authHeaders(USER1.getName()));

    // Add announcement thread for the entity from user1 to user2
    AnnouncementDetails announcementDetails =
        feedTest.getAnnouncementDetails("Announcement", 10, 11);
    Thread announcementThread =
        feedTest.createAnnouncement(
            USER1.getName(), about, "message", announcementDetails, authHeaders(USER1.getName()));

    // When the entity is deleted, all the threads also should be deleted
    deleteEntity(entity.getId(), true, true, ADMIN_AUTH_HEADERS);
    for (UUID id : listOf(thread.getId(), taskThread.getId(), announcementThread.getId())) {
      assertResponseContains(
          () -> feedTest.getThread(id, ADMIN_AUTH_HEADERS),
          NOT_FOUND,
          CatalogExceptionMessage.entityNotFound("Thread", id));
    }
  }

  //////////////////////////////////////////////////////////////////////////////////////////////////
  // Common entity functionality for tests
  //////////////////////////////////////////////////////////////////////////////////////////////////
  protected WebTarget getCollection() {
    return getResource(collectionName);
  }

  protected final WebTarget getResource(UUID id) {
    return getCollection().path("/" + id);
  }

  protected final WebTarget getResource(UUID id, Map<String, String> queryParams) {
    WebTarget target = getResource(id);
    for (Entry<String, String> entry : queryParams.entrySet()) {
      target = target.queryParam(entry.getKey(), entry.getValue());
    }
    return target;
  }

  protected final WebTarget getResourceByName(String name) {
    return getCollection().path("/name/" + name);
  }

  protected final WebTarget getRestoreResource() {
    return getCollection().path("/restore");
  }

  protected final WebTarget getFollowersCollection(UUID id) {
    return getResource(id).path("followers");
  }

  protected final WebTarget getFollowerResource(UUID id, UUID userId) {
    return getFollowersCollection(id).path("/" + userId);
  }

  public final T getEntity(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource(id);
    target = target.queryParam("fields", allFields);
    return TestUtils.get(target, entityClass, authHeaders);
  }

  public final T getEntity(UUID id, String fields, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(id);
    target = target.queryParam("fields", fields);
    return TestUtils.get(target, entityClass, authHeaders);
  }

  public final T getEntity(
      UUID id, Map<String, String> queryParams, String fields, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    for (Entry<String, String> entry :
        Optional.ofNullable(queryParams).orElse(Collections.emptyMap()).entrySet()) {
      target = target.queryParam(entry.getKey(), entry.getValue());
    }
    return TestUtils.get(target, entityClass, authHeaders);
  }

  public final T getEntityByName(String name, Map<String, String> authHeaders)
      throws HttpResponseException {
    return getEntityByName(name, null, "", authHeaders);
  }

  public final T getEntityByName(String name, String fields, Map<String, String> authHeaders)
      throws HttpResponseException {
    return getEntityByName(name, null, fields, authHeaders);
  }

  public final T getEntityByName(
      String name, Map<String, String> queryParams, String fields, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResourceByName(name);
    target = fields != null ? target.queryParam("fields", fields) : target;
    for (Entry<String, String> entry :
        Optional.ofNullable(queryParams).orElse(Collections.emptyMap()).entrySet()) {
      target = target.queryParam(entry.getKey(), entry.getValue());
    }
    return TestUtils.get(target, entityClass, authHeaders);
  }

  public final T createEntity(CreateEntity createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TestUtils.post(getCollection(), createRequest, entityClass, authHeaders);
  }

  public final T updateEntity(
      CreateEntity updateRequest, Status status, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TestUtils.put(getCollection(), updateRequest, entityClass, status, authHeaders);
  }

  public final T patchEntity(
      UUID id, String originalJson, T updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    return patchEntity(id, originalJson, updated, authHeaders, null);
  }

  public final T patchEntity(
      UUID id,
      String originalJson,
      T updated,
      Map<String, String> authHeaders,
      ChangeSource changeSource)
      throws HttpResponseException {
    try {
      ObjectMapper mapper = new ObjectMapper();
      updated.setOwners(reduceEntityReferences(updated.getOwners()));
      String updatedEntityJson = JsonUtils.pojoToJson(updated);
      JsonNode patch =
          JsonDiff.asJson(mapper.readTree(originalJson), mapper.readTree(updatedEntityJson));
      return patchEntity(id, patch, authHeaders, changeSource);
    } catch (JsonProcessingException ignored) {

    }
    return null;
  }

  public final T patchEntity(UUID id, JsonNode patch, Map<String, String> authHeaders)
      throws HttpResponseException {
    return patchEntity(id, patch, authHeaders, null);
  }

  public final T patchEntity(
      UUID id, JsonNode patch, Map<String, String> authHeaders, ChangeSource changeSource)
      throws HttpResponseException {
    Map<String, String> queryParams = new HashMap<>();
    if (changeSource != null) {
      queryParams.put("changeSource", changeSource.name());
    }
    return patch(getResource(id, queryParams), patch, entityClass, authHeaders);
  }

  public final T patchEntityUsingFqn(
      String fqn, String originalJson, T updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    try {
      updated.setOwners(reduceEntityReferences(updated.getOwners()));
      ObjectMapper mapper = new ObjectMapper();
      String updatedEntityJson = JsonUtils.pojoToJson(updated);
      JsonNode patch =
          JsonDiff.asJson(mapper.readTree(originalJson), mapper.readTree(updatedEntityJson));
      return patchEntityUsingFqn(fqn, patch, authHeaders);
    } catch (JsonProcessingException e) {
    }
    return null;
  }

  public final T patchEntityUsingFqn(String fqn, JsonNode patch, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TestUtils.patch(getResourceByName(fqn), patch, entityClass, authHeaders);
  }

  public final T deleteAndCheckEntity(T entity, Map<String, String> authHeaders)
      throws IOException {
    return deleteAndCheckEntity(entity, false, false, authHeaders);
  }

  public final T deleteAndCheckEntity(
      T entity, boolean recursive, boolean hardDelete, Map<String, String> authHeaders)
      throws IOException {
    T deletedEntity =
        deleteEntity(
            entity.getId(), recursive, hardDelete, authHeaders); // TODO fix this to include
    assertDeleted(deletedEntity, entity, hardDelete, authHeaders);
    return deletedEntity;
  }

  public final void deleteEntity(UUID id, Map<String, String> authHeaders)
      throws HttpResponseException {
    deleteEntity(id, false, false, authHeaders);
  }

  public final T deleteEntity(
      UUID id, boolean recursive, boolean hardDelete, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(id);
    target = recursive ? target.queryParam("recursive", true) : target;
    target = hardDelete ? target.queryParam("hardDelete", true) : target;
    T entity = TestUtils.delete(target, entityClass, authHeaders);
    assertEntityDeleted(id, hardDelete);
    return entity;
  }

  public final void deleteByNameAndCheckEntity(
      T entity, boolean recursive, boolean hardDelete, Map<String, String> authHeaders)
      throws IOException {
    T deletedEntity =
        deleteEntityByName(entity.getFullyQualifiedName(), recursive, hardDelete, authHeaders);
    assertDeleted(deletedEntity, entity, hardDelete, authHeaders);
  }

  private void assertDeleted(
      T deletedEntity, T entityBeforeDelete, boolean hardDelete, Map<String, String> authHeaders)
      throws HttpResponseException {
    long timestamp = deletedEntity.getUpdatedAt();

    // Validate delete change event
    if (supportsSoftDelete && !hardDelete) {
      Double expectedVersion = EntityUtil.nextVersion(entityBeforeDelete.getVersion());
      assertEquals(expectedVersion, deletedEntity.getVersion());
      validateDeletedEvent(
          deletedEntity.getId(),
          timestamp,
          EventType.ENTITY_SOFT_DELETED,
          expectedVersion,
          authHeaders);

      // Validate that the entity version is updated after soft delete
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("include", Include.DELETED.value());

      T getEntity = getEntity(deletedEntity.getId(), queryParams, allFields, authHeaders);
      assertEquals(deletedEntity.getVersion(), getEntity.getVersion());
      ChangeDescription change = getChangeDescription(entityBeforeDelete, MINOR_UPDATE);
      fieldUpdated(change, FIELD_DELETED, false, true);
      assertEquals(change, getEntity.getChangeDescription());
    } else { // Hard delete
      validateDeletedEvent(
          deletedEntity.getId(),
          timestamp,
          EventType.ENTITY_DELETED,
          deletedEntity.getVersion(),
          authHeaders);
    }
  }

  public final T deleteEntityByName(
      String name, boolean recursive, boolean hardDelete, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResourceByName(name);
    target = recursive ? target.queryParam("recursive", true) : target;
    target = hardDelete ? target.queryParam("hardDelete", true) : target;
    T entity = TestUtils.delete(target, entityClass, authHeaders);
    assertEntityDeleted(entity.getId(), hardDelete);
    return entity;
  }

  public final T restoreEntity(
      RestoreEntity restore, Status status, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getRestoreResource();
    return TestUtils.put(target, restore, entityClass, status, authHeaders);
  }

  /**
   * Helper function to create an entity, submit POST API request and validate response.
   */
  public T createAndCheckEntity(K create, Map<String, String> authHeaders) throws IOException {
    // Validate an entity that is created has all the information set in create request
    String updatedBy = SecurityUtil.getPrincipalName(authHeaders);
    T entity = createEntity(create, authHeaders);

    assertEquals(updatedBy, entity.getUpdatedBy());
    assertEquals(0.1, entity.getVersion()); // First version of the entity
    validateCommonEntityFields(entity, create, updatedBy);
    validateCreatedEntity(entity, create, authHeaders);

    // GET the entity created and ensure it has all the information set in create request
    T getEntity = getEntity(entity.getId(), authHeaders);
    assertEquals(0.1, entity.getVersion()); // First version of the entity
    validateCommonEntityFields(entity, create, updatedBy);
    validateCreatedEntity(getEntity, create, authHeaders);

    getEntity = getEntityByName(entity.getFullyQualifiedName(), allFields, authHeaders);
    assertEquals(0.1, entity.getVersion()); // First version of the entity
    validateCommonEntityFields(entity, create, updatedBy);
    validateCreatedEntity(getEntity, create, authHeaders);

    // Validate that change event was created
    validateChangeEvents(
        entity, entity.getUpdatedAt(), EventType.ENTITY_CREATED, null, authHeaders);
    return entity;
  }

  public T updateAndCheckEntity(
      K request,
      Status status,
      Map<String, String> authHeaders,
      UpdateType updateType,
      ChangeDescription changeDescription)
      throws IOException {
    T updated = updateEntity(request, status, authHeaders);
    validateUpdatedEntity(updated, request, authHeaders, updateType);
    validateChangeDescription(updated, updateType, changeDescription);
    validateEntityHistory(updated.getId(), updateType, changeDescription, authHeaders);
    validateLatestVersion(updated, updateType, changeDescription, authHeaders);

    // GET the newly updated entity and validate
    T getEntity = getEntity(updated.getId(), authHeaders);
    validateUpdatedEntity(getEntity, request, authHeaders, updateType);
    validateChangeDescription(getEntity, updateType, changeDescription);

    // Check if the entity change events are recorded
    if (updateType != NO_CHANGE) {
      EventType expectedEventType =
          updateType == CREATED ? EventType.ENTITY_CREATED : EventType.ENTITY_UPDATED;
      validateChangeEvents(
          updated, updated.getUpdatedAt(), expectedEventType, changeDescription, authHeaders);
    }
    return updated;
  }

  protected final void restoreAndCheckEntity(
      T entity, Map<String, String> authHeaders, ChangeDescription changeDescription)
      throws IOException {
    T updated = restoreEntity(new RestoreEntity().withId(entity.getId()), Status.OK, authHeaders);
    validateLatestVersion(updated, MINOR_UPDATE, changeDescription, authHeaders);
    // GET the newly updated entity and validate
    T getEntity = getEntity(updated.getId(), authHeaders);
    validateChangeDescription(getEntity, MINOR_UPDATE, changeDescription);
  }

  protected void validateEntityHistory(
      UUID id,
      UpdateType updateType,
      ChangeDescription expectedChangeDescription,
      Map<String, String> authHeaders)
      throws IOException {
    // GET ../entity/{id}/versions to list the all the versions of an entity
    EntityHistory history = getVersionList(id, authHeaders);
    T latestVersion = JsonUtils.readValue((String) history.getVersions().get(0), entityClass);
    Double version = null;
    for (Object x : history.getVersions()) {
      T e = JsonUtils.readValue((String) x, entityClass);
      if (version != null) {
        // Version must be in descending order
        assertTrue(version > e.getVersion());
      }
      version = e.getVersion();
    }

    // Make sure the latest version has changeDescription as received during update
    validateChangeDescription(latestVersion, updateType, expectedChangeDescription);
    if (updateType == CREATED) {
      // PUT used for creating entity, there is only one version
      assertEquals(1, history.getVersions().size());
    } else if (updateType == MINOR_UPDATE || updateType == MAJOR_UPDATE) {
      // Entity changed by PUT. Check the previous version exists
      T previousVersion = JsonUtils.readValue((String) history.getVersions().get(1), entityClass);
      assertEquals(expectedChangeDescription.getPreviousVersion(), previousVersion.getVersion());
    }
  }

  protected void validateLatestVersion(
      EntityInterface entityInterface,
      UpdateType updateType,
      ChangeDescription expectedChangeDescription,
      Map<String, String> authHeaders)
      throws IOException {
    // GET ../entity/{id}/versions/{versionId} to get specific versions of the entity
    // Get the latest version of the entity from the versions API and ensure it is correct
    T latestVersion =
        getVersion(entityInterface.getId(), entityInterface.getVersion(), authHeaders);
    validateChangeDescription(latestVersion, updateType, expectedChangeDescription);
    if (updateType == CREATED) {
      getVersion(entityInterface.getId(), 0.1, authHeaders);
    } else if (updateType == REVERT) {
      Double version = EntityUtil.previousVersion(entityInterface.getVersion());
      if (!version.equals(0.0)) {
        latestVersion = getVersion(entityInterface.getId(), version, authHeaders);
        assertEquals(expectedChangeDescription.getPreviousVersion(), latestVersion.getVersion());
      }
    } else if (updateType == MAJOR_UPDATE || updateType == MINOR_UPDATE) {
      // Get the previous version of the entity from the versions API and ensure it is correct
      T prevVersion =
          getVersion(
              entityInterface.getId(), expectedChangeDescription.getPreviousVersion(), authHeaders);
      assertEquals(expectedChangeDescription.getPreviousVersion(), prevVersion.getVersion());
    }
  }

  /**
   * Helper function to generate JSON PATCH, submit PATCH API request and validate response.
   */
  public final T patchEntityAndCheck(
      T updated,
      String originalJson,
      Map<String, String> authHeaders,
      UpdateType updateType,
      ChangeDescription expectedChange)
      throws IOException {
    return patchEntityAndCheck(
        updated, originalJson, authHeaders, updateType, expectedChange, null);
  }

  /**
   * Helper function to generate JSON PATCH, submit PATCH API request and validate response.
   */
  public final T patchEntityAndCheck(
      T updated,
      String originalJson,
      Map<String, String> authHeaders,
      UpdateType updateType,
      ChangeDescription expectedChange,
      ChangeSource changeSource)
      throws IOException {

    String updatedBy =
        updateType == NO_CHANGE ? updated.getUpdatedBy() : getPrincipalName(authHeaders);

    // Validate information returned in patch response has the updates
    T returned = patchEntity(updated.getId(), originalJson, updated, authHeaders, changeSource);

    validateCommonEntityFields(updated, returned, updatedBy);
    compareEntities(updated, returned, authHeaders);
    validateChangeDescription(returned, updateType, expectedChange);
    // since we are returning incremental changeevent as in response, this part would be difficult
    // to test
    // requires the test to pass incremental and aggregate change events
    // validateEntityHistory(returned.getId(), updateType, expectedChange, authHeaders);
    // validateLatestVersion(returned, updateType, expectedChange, authHeaders);

    // GET the entity and Validate information returned
    T getEntity = getEntity(returned.getId(), authHeaders);
    validateCommonEntityFields(updated, returned, updatedBy);
    compareEntities(updated, getEntity, authHeaders);
    // validateChangeDescription(getEntity, updateType, expectedChange);

    // Check if the entity change events are record
    if (listOf(CREATED, MINOR_UPDATE, MAJOR_UPDATE).contains(updateType)) {
      EventType expectedEventType =
          updateType == CREATED ? EventType.ENTITY_CREATED : EventType.ENTITY_UPDATED;
      validateChangeEvents(
          returned, returned.getUpdatedAt(), expectedEventType, expectedChange, authHeaders);
    }
    return returned;
  }

  /**
   * Helper function to generate JSON PATCH, submit PATCH API using fully qualified name and validate response.
   */
  protected final T patchEntityUsingFqnAndCheck(
      T updated,
      String originalJson,
      Map<String, String> authHeaders,
      UpdateType updateType,
      ChangeDescription expectedChange)
      throws IOException {

    String updatedBy =
        updateType == NO_CHANGE ? updated.getUpdatedBy() : getPrincipalName(authHeaders);

    // Validate information returned in patch response has the updates
    T returned =
        patchEntityUsingFqn(updated.getFullyQualifiedName(), originalJson, updated, authHeaders);

    validateCommonEntityFields(updated, returned, updatedBy);
    compareEntities(updated, returned, authHeaders);
    validateChangeDescription(returned, updateType, expectedChange);
    // validateEntityHistory(returned.getId(), updateType, expectedChange, authHeaders);
    // validateLatestVersion(returned, updateType, expectedChange, authHeaders);

    // GET the entity and Validate information returned
    T getEntity = getEntity(returned.getId(), authHeaders);
    validateCommonEntityFields(updated, returned, updatedBy);
    compareEntities(updated, getEntity, authHeaders);
    // validateChangeDescription(getEntity, updateType, expectedChange);

    // Check if the entity change events are record
    if (listOf(CREATED, MINOR_UPDATE, MAJOR_UPDATE).contains(updateType)) {
      EventType expectedEventType =
          updateType == CREATED ? EventType.ENTITY_CREATED : EventType.ENTITY_UPDATED;
      validateChangeEvents(
          returned, returned.getUpdatedAt(), expectedEventType, expectedChange, authHeaders);
    }
    return returned;
  }

  protected T patchEntityAndCheckAuthorization(
      T entity, String userName, boolean shouldThrowException) throws IOException {
    return patchEntityAndCheckAuthorization(
        entity, userName, MetadataOperation.EDIT_OWNERS, shouldThrowException);
  }

  protected T patchEntityAndCheckAuthorization(
      T entity,
      String userName,
      MetadataOperation disallowedOperation,
      boolean shouldThrowException)
      throws IOException {
    String originalJson = JsonUtils.pojoToJson(entity);
    Map<String, String> authHeaders = authHeaders(userName + "@open-metadata.org");
    if (shouldThrowException) {
      assertResponse(
          () -> patchEntity(entity.getId(), originalJson, entity, authHeaders),
          FORBIDDEN,
          List.of(
              "User does not have ANY of the required permissions.",
              permissionNotAllowed(userName, List.of(disallowedOperation))));
      return entity;
    }

    // Update the entity description and verify the user is authorized to do it
    String newDescription = format("Description added by %s", userName);
    ChangeDescription change = getChangeDescription(entity, MINOR_UPDATE);
    fieldUpdated(change, "description", entity.getDescription(), newDescription);
    entity.setDescription(newDescription);
    return patchEntityAndCheck(entity, originalJson, authHeaders, MINOR_UPDATE, change);
  }

  protected void validateCommonEntityFields(T entity, CreateEntity create, String updatedBy) {
    assertListNotNull(entity.getId(), entity.getHref(), entity.getFullyQualifiedName());
    assertEquals(create.getName(), entity.getName());
    assertEquals(create.getDisplayName(), entity.getDisplayName());
    assertEquals(create.getDescription(), entity.getDescription());
    assertEquals(
        JsonUtils.valueToTree(create.getExtension()), JsonUtils.valueToTree(entity.getExtension()));
    assertReferenceList(create.getOwners(), entity.getOwners());
    assertEquals(updatedBy, entity.getUpdatedBy());
  }

  protected final void validateCommonEntityFields(T expected, T actual, String updatedBy) {
    assertListNotNull(actual.getId(), actual.getHref(), actual.getFullyQualifiedName());
    assertEquals(expected.getName(), actual.getName());
    assertEquals(expected.getDisplayName(), actual.getDisplayName());
    assertEquals(expected.getDescription(), actual.getDescription());
    if (!JsonUtils.valueToTree(expected.getExtension()).isEmpty()
        && !JsonUtils.valueToTree(actual.getExtension()).isEmpty()) {
      assertReferenceList(expected.getOwners(), actual.getOwners());
      assertEquals(updatedBy, actual.getUpdatedBy());
    }
  }

  protected final void validateChangeDescription(
      T updated, UpdateType updateType, ChangeDescription expectedChange) throws IOException {
    if (updateType == CREATED) {
      assertEquals(0.1, updated.getVersion());
      assertNull(updated.getChangeDescription());
      return;
    }
    assertChangeDescription(expectedChange, updated.getChangeDescription());
  }

  private void assertChangeDescription(ChangeDescription expected, ChangeDescription actual)
      throws IOException {
    if (expected == actual) {
      return;
    }
    assertEquals(expected.getPreviousVersion(), actual.getPreviousVersion());
    assertFieldLists(expected.getFieldsAdded(), actual.getFieldsAdded());
    assertFieldLists(expected.getFieldsUpdated(), actual.getFieldsUpdated());
    assertFieldLists(expected.getFieldsDeleted(), actual.getFieldsDeleted());
  }

  /**
   * This method validates the change event created after POST, PUT, and PATCH operations and ensures entityCreate,
   * entityUpdated, and entityDeleted change events are created in the system with valid date.
   */
  protected final void validateChangeEvents(
      T entityInterface,
      long timestamp,
      EventType expectedEventType,
      ChangeDescription expectedChangeDescription,
      Map<String, String> authHeaders)
      throws IOException {
    if (!EVENT_SUBSCRIPTION_TEST_CONTROL_FLAG) {
      return;
    }
    validateChangeEvents(
        entityInterface,
        timestamp,
        expectedEventType,
        expectedChangeDescription,
        authHeaders,
        true);
    validateChangeEvents(
        entityInterface,
        timestamp,
        expectedEventType,
        expectedChangeDescription,
        authHeaders,
        false);
  }

  public void assertEntityReferenceFieldChange(Object expected, Object actual) {
    EntityReference expectedRef =
        expected instanceof EntityReference
            ? (EntityReference) expected
            : JsonUtils.readValue((String) expected, EntityReference.class);
    EntityReference actualRef = JsonUtils.readValue(actual.toString(), EntityReference.class);
    assertEquals(expectedRef.getId(), actualRef.getId());
  }

  public void assertEntityNamesFieldChange(Object expected, Object actual) {
    @SuppressWarnings("unchecked")
    List<String> expectedRefs = (List<String>) expected;
    List<EntityReference> actualRefs =
        JsonUtils.readObjects(actual.toString(), EntityReference.class);
    assertEntityReferenceNames(expectedRefs, actualRefs);
  }

  public void assertColumnsFieldChange(Object expected, Object actual)
      throws HttpResponseException {
    @SuppressWarnings("unchecked")
    List<Column> expectedRefs =
        expected instanceof List
            ? (List<Column>) expected
            : JsonUtils.readObjects(expected.toString(), Column.class);
    List<Column> actualRefs = JsonUtils.readObjects(actual.toString(), Column.class);
    TableResourceTest.assertColumns(expectedRefs, actualRefs);
  }

  public void assertEntityReferencesFieldChange(Object expected, Object actual) {
    @SuppressWarnings("unchecked")
    List<EntityReference> expectedRefs =
        expected instanceof List
            ? (List<EntityReference>) expected
            : JsonUtils.readObjects(expected.toString(), EntityReference.class);
    List<EntityReference> actualRefs =
        JsonUtils.readObjects(actual.toString(), EntityReference.class);
    assertEntityReferences(expectedRefs, actualRefs);
  }

  public void assertEntityReference(Object expected, Object actual) {
    EntityReference expectedRef =
        expected instanceof EntityReference
            ? (EntityReference) expected
            : JsonUtils.readValue(expected.toString(), EntityReference.class);
    EntityReference actualRef = JsonUtils.readValue(actual.toString(), EntityReference.class);
    assertEquals(expectedRef.getId(), actualRef.getId());
    assertEquals(expectedRef.getDisplayName(), actualRef.getDisplayName());
  }

  public static class EventHolder {
    @Getter ChangeEvent expectedEvent;

    public boolean hasExpectedEvent(ResultList<ChangeEvent> changeEvents, long timestamp) {
      for (ChangeEvent event : listOrEmpty(changeEvents.getData())) {
        if (event.getTimestamp() == timestamp) {
          expectedEvent = event;
          break;
        }
      }
      return expectedEvent != null;
    }

    public boolean hasDeletedEvent(ResultList<ChangeEvent> changeEvents, UUID id) {
      for (ChangeEvent event : changeEvents.getData()) {
        if (event.getEntityId().equals(id)) {
          expectedEvent = event;
          break;
        }
      }
      return expectedEvent != null;
    }
  }

  private void validateChangeEvents(
      T entity,
      long timestamp,
      EventType expectedEventType,
      ChangeDescription expectedChangeDescription,
      Map<String, String> authHeaders,
      boolean withEventFilter)
      throws IOException {
    // Get change event with an event filter for specific entity type if withEventFilter is True.
    // Else get all entities.
    String createdFilter = withEventFilter ? entityType : "*";
    String updatedFilter = withEventFilter ? entityType : "*";
    EventHolder eventHolder = new EventHolder();

    Awaitility.await("Wait for expected change event at timestamp " + timestamp)
        .pollInterval(Duration.ofMillis(100L))
        .atMost(Duration.ofMillis(600 * 100L)) // 300 iterations for 30 seconds
        .until(
            () ->
                eventHolder.hasExpectedEvent(
                    getChangeEvents(
                        createdFilter, updatedFilter, null, null, timestamp, authHeaders),
                    timestamp));
    ChangeEvent changeEvent = eventHolder.getExpectedEvent();
    assertNotNull(
        changeEvent,
        "Expected change event "
            + expectedEventType
            + " at "
            + timestamp
            + " was not found for entity "
            + entity.getId());

    assertEquals(expectedEventType, changeEvent.getEventType());
    assertEquals(entityType, changeEvent.getEntityType());
    assertEquals(entity.getId(), changeEvent.getEntityId());
    assertEquals(entity.getVersion(), changeEvent.getCurrentVersion());
    assertEquals(SecurityUtil.getPrincipalName(authHeaders), changeEvent.getUserName());

    //
    // previous, entity, changeDescription
    //
    if (expectedEventType == EventType.ENTITY_CREATED) {
      assertEquals(EventType.ENTITY_CREATED, changeEvent.getEventType());
      assertEquals(0.1, changeEvent.getPreviousVersion());
      assertNull(changeEvent.getChangeDescription());
      T changeEventEntity = JsonUtils.readOrConvertValue(changeEvent.getEntity(), entityClass);
      validateCommonEntityFields(entity, changeEventEntity, getPrincipalName(authHeaders));
      compareChangeEventsEntities(entity, changeEventEntity, authHeaders);
    } else if (expectedEventType == EventType.ENTITY_UPDATED) {
      assertChangeDescription(expectedChangeDescription, changeEvent.getChangeDescription());
    } else if (expectedEventType == EventType.ENTITY_DELETED) {
      assertListNull(changeEvent.getEntity(), changeEvent.getChangeDescription());
    }
  }

  private void validateDeletedEvent(
      UUID id,
      long timestamp,
      EventType expectedEventType,
      Double expectedVersion,
      Map<String, String> authHeaders) {
    if (!EVENT_SUBSCRIPTION_TEST_CONTROL_FLAG) {
      return;
    }
    String updatedBy = SecurityUtil.getPrincipalName(authHeaders);
    EventHolder eventHolder = new EventHolder();

    Awaitility.await("Wait for expected deleted event at timestamp " + timestamp)
        .pollInterval(Duration.ofMillis(100L))
        .atMost(Duration.ofMillis(600 * 100L)) // 100 iterations
        .until(
            () ->
                eventHolder.hasDeletedEvent(
                    getChangeEvents(null, null, null, entityType, timestamp, authHeaders), id));
    ChangeEvent changeEvent = eventHolder.getExpectedEvent();

    assertNotNull(
        changeEvent, "Deleted event after " + timestamp + " was not found for entity " + id);
    assertEquals(expectedEventType, changeEvent.getEventType());
    assertEquals(entityType, changeEvent.getEntityType());
    assertEquals(id, changeEvent.getEntityId());
    assertEquals(expectedVersion, changeEvent.getCurrentVersion());
    assertEquals(updatedBy, changeEvent.getUserName());
  }

  protected EntityHistory getVersionList(UUID id, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(id).path("/versions");
    return TestUtils.get(target, EntityHistory.class, authHeaders);
  }

  protected ResultList<ChangeEvent> getChangeEvents(
      String entityCreated,
      String entityUpdated,
      String entityRestored,
      String entityDeleted,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("events");
    target = entityCreated == null ? target : target.queryParam("entityCreated", entityCreated);
    target = entityUpdated == null ? target : target.queryParam("entityUpdated", entityUpdated);
    target = entityUpdated == null ? target : target.queryParam("entityRestored", entityRestored);
    target = entityDeleted == null ? target : target.queryParam("entityDeleted", entityDeleted);
    return TestUtils.get(target, EventList.class, authHeaders);
  }

  protected ResultList<ChangeEvent> getChangeEvents(
      String entityCreated,
      String entityUpdated,
      String entityRestored,
      String entityDeleted,
      long timestamp,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("events");
    target = entityCreated == null ? target : target.queryParam("entityCreated", entityCreated);
    target = entityUpdated == null ? target : target.queryParam("entityUpdated", entityUpdated);
    target = entityUpdated == null ? target : target.queryParam("entityRestored", entityRestored);
    target = entityDeleted == null ? target : target.queryParam("entityDeleted", entityDeleted);
    target = target.queryParam("timestamp", timestamp);
    return TestUtils.get(target, EventList.class, authHeaders);
  }

  protected T getVersion(UUID id, Double version, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(id).path("/versions/" + version.toString());
    return TestUtils.get(target, entityClass, authHeaders);
  }

  protected void assertFieldLists(List<FieldChange> expectedList, List<FieldChange> actualList)
      throws IOException {
    expectedList.sort(EntityUtil.compareFieldChange);
    actualList.sort(EntityUtil.compareFieldChange);
    assertEquals(expectedList.size(), actualList.size());

    for (int i = 0; i < expectedList.size(); i++) {
      assertEquals(expectedList.get(i).getName(), actualList.get(i).getName());
      assertFieldChange(
          expectedList.get(i).getName(),
          expectedList.get(i).getNewValue(),
          actualList.get(i).getNewValue());
      assertFieldChange(
          expectedList.get(i).getName(),
          expectedList.get(i).getOldValue(),
          actualList.get(i).getOldValue());
    }
  }

  protected final void assertCommonFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals(FIELD_EXPERTS) || fieldName.equals(FIELD_REVIEWERS)) {
      assertEntityReferencesFieldChange(expected, actual);
    } else if ((fieldName.endsWith(FIELD_OWNERS)
            || fieldName.equals(Entity.FIELD_DOMAINS)
            || fieldName.equals(FIELD_DATA_PRODUCTS))
        && (expected != null && actual != null)) {
      @SuppressWarnings("unchecked")
      List<EntityReference> expectedRefList =
          expected instanceof List
              ? (List<EntityReference>) expected
              : JsonUtils.readObjects(expected.toString(), EntityReference.class);
      List<EntityReference> actualRefList =
          JsonUtils.readObjects(actual.toString(), EntityReference.class);
      assertReferenceList(expectedRefList, actualRefList);
    } else if (fieldName.equals(FIELD_PARENT)) {
      assertEntityReferenceFieldChange(expected, actual);
    } else if (fieldName.endsWith(FIELD_TAGS)) {
      @SuppressWarnings("unchecked")
      List<TagLabel> expectedTags =
          expected instanceof List
              ? (List<TagLabel>) expected
              : JsonUtils.readObjects(expected.toString(), TagLabel.class);
      List<TagLabel> actualTags = JsonUtils.readObjects(actual.toString(), TagLabel.class);
      assertTrue(actualTags.containsAll(expectedTags));
      actualTags.forEach(tagLabel -> assertNotNull(tagLabel.getDescription()));
    } else if (fieldName.startsWith(
        "extension")) { // Custom properties related extension field changes
      assertEquals(expected.toString().replace(" ", ""), actual.toString());
    } else if (fieldName.equals(
        "domainType")) { // Custom properties related extension field changes
      assertEquals(expected, DomainType.fromValue(actual.toString()));
    } else if (fieldName.equals("style")) {
      Style expectedStyle =
          expected instanceof Style
              ? (Style) expected
              : JsonUtils.readValue(expected.toString(), Style.class);
      assertStyle(expectedStyle, JsonUtils.readValue(actual.toString(), Style.class));
    } else {
      // All the other fields
      assertEquals(expected, actual, "Field name " + fieldName);
    }
  }

  protected ChangeDescription getChangeDescription(
      EntityInterface currentEntity, UpdateType updateType) throws HttpResponseException {
    if (updateType == REVERT) {
      // If reverting to a previous version, the change description comes from that version
      T previousEntity =
          getVersion(
              currentEntity.getId(),
              currentEntity.getChangeDescription().getPreviousVersion(),
              ADMIN_AUTH_HEADERS);
      return previousEntity.getChangeDescription();
    } else if (updateType == NO_CHANGE) {
      return currentEntity.getChangeDescription();
    }

    Double previousVersion;
    if (updateType == CHANGE_CONSOLIDATED) {
      previousVersion = currentEntity.getChangeDescription().getPreviousVersion();
    } else {
      // In this case, current version is changed to the newer version.
      // The test needs to add fields added, updated, and deleted
      previousVersion = currentEntity.getVersion();
    }
    // For minor and major updates, the current entity becomes previous entity
    return new ChangeDescription()
        .withPreviousVersion(previousVersion)
        .withFieldsAdded(new ArrayList<>())
        .withFieldsUpdated(new ArrayList<>())
        .withFieldsDeleted(new ArrayList<>());
  }

  /**
   * Compare fullyQualifiedName in the entityReference
   */
  protected static void assertReference(String expected, EntityReference actual) {
    if (expected != null) {
      assertNotNull(actual);
      TestUtils.validateEntityReference(actual);
      assertEquals(expected, actual.getFullyQualifiedName());
    } else {
      assertNull(actual);
    }
  }

  protected static void assertReferenceList(
      List<EntityReference> expected, List<EntityReference> actual) {
    if (!nullOrEmpty(expected) && !nullOrEmpty(actual)) {
      List<UUID> expectedUuids = expected.stream().map(EntityReference::getId).toList();
      List<UUID> actualUuids = actual.stream().map(EntityReference::getId).toList();
      assertTrue(
          expectedUuids.size() == actualUuids.size()
              && expectedUuids.containsAll(actualUuids)
              && actualUuids.containsAll(expectedUuids));
    }
  }

  /**
   * Compare entity Id and types in the entityReference
   */
  protected static void assertReference(EntityReference expected, EntityReference actual) {
    // If the actual value is inherited, it will never match the expected
    // We just ignore the validation in these cases
    if (actual != null && actual.getInherited() != null && actual.getInherited()) {
      return;
    }
    if (expected != null) {
      assertNotNull(actual);
      TestUtils.validateEntityReference(actual);
      assertEquals(expected.getId(), actual.getId());
      assertEquals(expected.getType(), actual.getType());
    } else {
      assertNull(actual);
    }
  }

  protected void assertEntityReferenceFromSearch(T entity, EntityReference actual, String keyword)
      throws IOException {
    RestClient searchClient = getSearchClient();
    IndexMapping index = Entity.getSearchRepository().getIndexMapping(entityType);
    // Direct request to es needs to have es clusterAlias appended with indexName
    Request request =
        new Request(
            "GET",
            String.format(
                "%s/_search", index.getIndexName(Entity.getSearchRepository().getClusterAlias())));
    String query =
        String.format(
            "{\"query\":{\"bool\":{\"filter\":[{\"term\":{\"_id\":\"%s\"}}]}}}", entity.getId());
    request.setJsonEntity(query);
    try {
      assertEventually(
          "assertEntityReferenceFromSearch_" + entity.getFullyQualifiedName(),
          () -> {
            es.org.elasticsearch.client.Response response = searchClient.performRequest(request);
            String jsonString = EntityUtils.toString(response.getEntity());
            @SuppressWarnings("unchecked")
            HashMap<String, Object> map =
                (HashMap<String, Object>) JsonUtils.readOrConvertValue(jsonString, HashMap.class);
            @SuppressWarnings("unchecked")
            LinkedHashMap<String, Object> hits = (LinkedHashMap<String, Object>) map.get("hits");
            @SuppressWarnings("unchecked")
            ArrayList<LinkedHashMap<String, Object>> hitsList =
                (ArrayList<LinkedHashMap<String, Object>>) hits.get("hits");
            assertEquals(1, hitsList.size());
            LinkedHashMap<String, Object> doc = hitsList.get(0);
            @SuppressWarnings("unchecked")
            LinkedHashMap<String, Object> source =
                (LinkedHashMap<String, Object>) doc.get("_source");

            List<EntityReference> domainReference =
                JsonUtils.convertObjects(source.get(keyword), EntityReference.class);
            assertEquals(domainReference.get(0).getId(), actual.getId());
            assertEquals(domainReference.get(0).getType(), actual.getType());
          });
    } finally {
      searchClient.close();
    }
  }

  protected static void checkOwnerOwns(EntityReference owner, UUID entityId, boolean expectedOwning)
      throws HttpResponseException {
    if (owner != null) {
      UUID ownerId = owner.getId();
      List<EntityReference> ownsList;
      if (owner.getType().equals(Entity.USER)) {
        User user = new UserResourceTest().getEntity(ownerId, "owns", ADMIN_AUTH_HEADERS);
        ownsList = user.getOwns();
      } else if (owner.getType().equals(Entity.TEAM)) {
        Team team = new TeamResourceTest().getEntity(ownerId, "owns", ADMIN_AUTH_HEADERS);
        ownsList = team.getOwns();
      } else {
        throw new IllegalArgumentException("Invalid owner type " + owner.getType());
      }

      TestUtils.existsInEntityReferenceList(ownsList, entityId, expectedOwning);
    }
  }

  public void addAndCheckFollower(
      UUID entityId,
      UUID userId,
      Status status,
      int totalFollowerCount,
      Map<String, String> authHeaders)
      throws IOException {
    ChangeEvent event = addFollower(entityId, userId, status, authHeaders);

    // GET .../entity/{entityId} returns newly added follower
    T getEntity = getEntity(entityId, authHeaders);
    List<EntityReference> followers = getEntity.getFollowers();

    assertEquals(totalFollowerCount, followers.size());
    validateEntityReferences(followers);
    TestUtils.existsInEntityReferenceList(followers, userId, true);

    // GET .../users/{userId} shows user as following the entity
    checkUserFollowing(userId, entityId, true, authHeaders);

    // Validate change events
    validateChangeEvents(
        getEntity,
        event.getTimestamp(),
        EventType.ENTITY_UPDATED,
        event.getChangeDescription(),
        authHeaders);
  }

  public ChangeEvent addFollower(
      UUID entityId, UUID userId, Status status, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getFollowersCollection(entityId);
    return TestUtils.put(target, userId, ChangeEvent.class, status, authHeaders);
  }

  protected void deleteAndCheckFollower(
      UUID entityId, UUID userId, int totalFollowerCount, Map<String, String> authHeaders)
      throws IOException {
    // Delete the follower
    WebTarget target = getFollowerResource(entityId, userId);
    ChangeEvent change = TestUtils.delete(target, ChangeEvent.class, authHeaders);

    // Get the entity and ensure the deleted follower is not in the followers list
    T getEntity = checkFollowerDeleted(entityId, userId, authHeaders);
    assertEquals(totalFollowerCount, getEntity.getFollowers().size());

    // Validate change events
    validateChangeEvents(
        getEntity,
        change.getTimestamp(),
        EventType.ENTITY_UPDATED,
        change.getChangeDescription(),
        authHeaders);
  }

  public T checkFollowerDeleted(UUID entityId, UUID userId, Map<String, String> authHeaders)
      throws HttpResponseException {
    // Get the entity and ensure the deleted follower is not in the followers list
    T getEntity = getEntity(entityId, authHeaders);
    List<EntityReference> followers = getEntity.getFollowers();
    validateEntityReferences(followers);
    TestUtils.existsInEntityReferenceList(followers, userId, false);
    return getEntity;
  }

  public ResultList<T> listEntities(
      Map<String, String> queryParams, Map<String, String> authHeaders)
      throws HttpResponseException {
    return listEntities(queryParams, null, null, null, authHeaders);
  }

  public ResultList<T> listEntities(
      Map<String, String> queryParams,
      Integer limit,
      String before,
      String after,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection();
    for (Entry<String, String> entry :
        Optional.ofNullable(queryParams).orElse(Collections.emptyMap()).entrySet()) {
      target = target.queryParam(entry.getKey(), entry.getValue());
    }

    target = limit != null ? target.queryParam("limit", limit) : target;
    target = before != null ? target.queryParam("before", before) : target;
    target = after != null ? target.queryParam("after", after) : target;
    return TestUtils.get(target, entityListClass, authHeaders);
  }

  public ResultList<T> listEntitiesFromSearch(
      Map<String, String> queryParams,
      Integer limit,
      Integer offset,
      Map<String, String> authHeader)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/search/list");
    for (Map.Entry<String, String> entry : queryParams.entrySet()) {
      target = target.queryParam(entry.getKey(), entry.getValue());
    }
    target = limit != null ? target.queryParam("limit", limit) : target;
    target = offset != null ? target.queryParam("offset", offset) : target;
    return TestUtils.get(target, entityListClass, authHeader);
  }

  private void printEntities(ResultList<T> list) {
    list.getData().forEach(e -> LOG.debug("{} {}", entityClass, e.getFullyQualifiedName()));
    LOG.debug("before {} after {} ", list.getPaging().getBefore(), list.getPaging().getAfter());
  }

  public void assertEntityDeleted(T entity, boolean hardDelete) {
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("include", hardDelete ? Include.ALL.value() : Include.NON_DELETED.value());

    // Make sure getting entity by ID get 404 not found response
    assertEntityDeleted(entity.getId(), hardDelete);

    // Make sure getting entity by name gets 404 not found response
    assertResponse(
        () -> getEntityByName(entity.getFullyQualifiedName(), queryParams, "", ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(entityType, entity.getFullyQualifiedName()));
  }

  public void assertEntityDeleted(UUID id, boolean hardDelete) {
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("include", hardDelete ? Include.ALL.value() : Include.NON_DELETED.value());
    assertResponse(
        () -> getEntity(id, queryParams, "", ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(entityType, id));
  }

  /**
   * Given a list of properties of an Entity (e.g., List<Column> or List<MlFeature> and a function that validate the
   * elements of T, validate lists
   */
  public <P> void assertListProperty(List<P> expected, List<P> actual, BiConsumer<P, P> validate) {
    if (nullOrEmpty(expected) && nullOrEmpty(actual)) {
      return;
    }

    assertNotNull(expected);
    assertEquals(expected.size(), actual.size());
    for (int i = 0; i < expected.size(); i++) {
      validate.accept(expected.get(i), actual.get(i));
    }
  }

  protected void assertEntityReferences(
      List<EntityReference> expectedList, List<EntityReference> actualList) {
    if (nullOrEmpty(expectedList) && nullOrEmpty(actualList)) {
      return;
    }
    for (EntityReference expected : expectedList) {
      EntityReference actual =
          actualList.stream()
              .filter(a -> EntityUtil.entityReferenceMatch.test(a, expected))
              .findAny()
              .orElse(null);
      assertNotNull(actual, "Expected entity reference " + expected.getId() + " not found");
    }
  }

  protected void assertEntityReferencesContain(
      List<EntityReference> list, EntityReference reference) {
    assertFalse(listOrEmpty(list).isEmpty());
    EntityReference actual =
        list.stream()
            .filter(a -> EntityUtil.entityReferenceMatch.test(a, reference))
            .findAny()
            .orElse(null);
    assertNotNull(actual, "Expected entity reference " + reference.getId() + " not found");
  }

  protected void assertEntityReferencesDoesNotContain(
      List<EntityReference> list, EntityReference reference) {
    if (listOrEmpty(list).isEmpty()) {
      return; // Empty list does not contain the reference we are looking for
    }
    EntityReference actual =
        list.stream()
            .filter(a -> EntityUtil.entityReferenceMatch.test(a, reference))
            .findAny()
            .orElse(null);
    assertNull(actual, "Expected entity reference " + reference.getId() + " is still found");
  }

  protected void assertStrings(List<String> expectedList, List<String> actualList) {
    for (String expected : expectedList) {
      String actual =
          actualList.stream()
              .filter(a -> EntityUtil.stringMatch.test(a, expected))
              .findAny()
              .orElse(null);
      assertNotNull(actual, "Expected string " + expected + " not found");
    }
  }

  protected void assertTermReferences(
      List<TermReference> expectedList, List<TermReference> actualList) {
    for (TermReference expected : expectedList) {
      TermReference actual =
          actualList.stream()
              .filter(a -> EntityUtil.termReferenceMatch.test(a, expected))
              .findAny()
              .orElse(null);
      assertNotNull(actual, "Expected termReference " + expected + " not found");
    }
  }

  public final String getEntityName(TestInfo test) {
    // supportedNameCharacters is added to ensure the names are escaped correctly in backend SQL
    // queries
    return format(
        "%s%s%s",
        entityType, supportedNameCharacters, test.getDisplayName().replaceAll("\\(.*\\)", ""));
  }

  /**
   * Generates and entity name by adding a char from a-z to ensure alphanumeric ordering In alphanumeric ordering using
   * numbers can be counterintuitive (e.g :entity_0_test < entity_10_test < entity_1_test is the correct ordering of
   * these 3 strings)
   */
  public final String getEntityName(TestInfo test, int index) {
    // supportedNameCharacters is added to ensure the names are escaped correctly in backend SQL
    // queries
    return format(
        "%s%s%s%s",
        entityType,
        supportedNameCharacters,
        test.getDisplayName().replaceAll("\\(.*\\)", ""),
        getNthAlphanumericString(index));
  }

  /**
   * Transforms a positive integer to base 26 using digits a...z Alphanumeric ordering of results is equivalent to
   * ordering of inputs
   */
  private String getNthAlphanumericString(int index) {
    final int N_LETTERS = 26;
    if (index < 0) {
      throw new IllegalArgumentException(format("Index must be positive, cannot be %d", index));
    }
    if (index < 26) {
      return String.valueOf((char) ('a' + index));
    }
    return getNthAlphanumericString(index / N_LETTERS) + (char) ('a' + (index % N_LETTERS));
  }

  public static <T extends EntityInterface> EntityReference reduceEntityReference(T entity) {
    return reduceEntityReference(entity == null ? null : entity.getEntityReference());
  }

  public static <T extends EntityInterface> List<EntityReference> reduceEntityReferences(
      List<EntityReference> entities) {
    List<EntityReference> reducedEntities = new ArrayList<>();
    for (EntityReference entity : listOrEmpty(entities)) {
      EntityReference reducedRef = reduceEntityReference(entity);
      if (reducedRef != null) {
        reducedEntities.add(reducedRef);
      }
    }
    return reducedEntities;
  }

  public static EntityReference reduceEntityReference(EntityReference ref) {
    // In requests send minimum entity reference information to ensure the server fills rest of the
    // details
    return ref != null && (ref.getInherited() == null || !ref.getInherited())
        ? new EntityReference()
            .withType(ref.getType())
            .withId(ref.getId())
            .withInherited(ref.getInherited())
        : null;
  }

  public String getAllowedFields() {
    return String.join(",", Entity.getEntityFields(entityClass));
  }

  public CsvImportResult importCsv(String entityName, String csv, boolean dryRun)
      throws HttpResponseException {
    WebTarget target = getResourceByName(entityName + "/import");
    target = !dryRun ? target.queryParam("dryRun", false) : target;
    return TestUtils.putCsv(target, csv, CsvImportResult.class, Status.OK, ADMIN_AUTH_HEADERS);
  }

  public CsvImportResult importCsvRecursive(String entityName, String csv, boolean dryRun)
      throws HttpResponseException {
    WebTarget target = getResourceByName(entityName + "/import").queryParam("recursive", "true");
    target = !dryRun ? target.queryParam("dryRun", false) : target;
    return TestUtils.putCsv(target, csv, CsvImportResult.class, Status.OK, ADMIN_AUTH_HEADERS);
  }

  protected String exportCsv(String entityName) throws HttpResponseException {
    WebTarget target = getResourceByName(entityName + "/export");
    return TestUtils.get(target, String.class, ADMIN_AUTH_HEADERS);
  }

  protected String exportCsvRecursive(String entityName) throws HttpResponseException {
    WebTarget target = getResourceByName(entityName + "/export").queryParam("recursive", "true");
    return TestUtils.get(target, String.class, ADMIN_AUTH_HEADERS);
  }

  private String receiveCsvViaSocketIO(String entityName) throws Exception {
    UUID userId = getAdminUserId();
    String uri = String.format("http://localhost:%d", APP.getLocalPort());

    IO.Options options = new IO.Options();
    options.path = "/api/v1/push/feed";
    options.query = "userId=" + userId.toString();
    options.transports = new String[] {"websocket"};
    options.reconnection = false;
    options.timeout = 10000; // 10 seconds

    Socket socket = IO.socket(uri, options);

    CountDownLatch connectLatch = new CountDownLatch(1);
    CountDownLatch messageLatch = new CountDownLatch(1);
    final String[] receivedMessage = new String[1];

    socket
        .on(
            Socket.EVENT_CONNECT,
            args -> {
              System.out.println("Connected to Socket.IO server");
              connectLatch.countDown();
            })
        .on(
            "csvExportChannel",
            args -> {
              receivedMessage[0] = (String) args[0];
              System.out.println("Received message: " + receivedMessage[0]);
              messageLatch.countDown();
              socket.disconnect();
            })
        .on(
            Socket.EVENT_CONNECT_ERROR,
            args -> {
              System.err.println("Socket.IO connect error: " + args[0]);
              connectLatch.countDown();
              messageLatch.countDown();
            })
        .on(
            Socket.EVENT_DISCONNECT,
            args -> System.out.println("Disconnected from Socket.IO server"));

    socket.connect();
    if (!connectLatch.await(10, TimeUnit.SECONDS)) {
      fail("Could not connect to Socket.IO server");
    }

    // Initiate the export after connection is established
    String jobId = initiateExport(entityName);

    if (!messageLatch.await(30, TimeUnit.SECONDS)) {
      fail("Did not receive CSV data via Socket.IO within the expected time.");
    }

    String receivedJson = receivedMessage[0];
    if (receivedJson == null) {
      fail("Received message is null.");
    }

    CSVExportMessage csvExportMessage = JsonUtils.readValue(receivedJson, CSVExportMessage.class);
    if ("COMPLETED".equals(csvExportMessage.getStatus())) {
      return csvExportMessage.getData();
    } else if ("FAILED".equals(csvExportMessage.getStatus())) {
      fail("CSV export failed: " + csvExportMessage.getError());
    } else {
      fail("Unknown status received: " + csvExportMessage.getStatus());
    }
    return null;
  }

  private String receiveCsvImportViaSocketIO(String entityName, String csv, boolean dryRun)
      throws Exception {
    UUID userId = getAdminUserId();
    String uri = format("http://localhost:%d", APP.getLocalPort());

    IO.Options options = new IO.Options();
    options.path = "/api/v1/push/feed";
    options.query = "userId=" + userId.toString();
    options.transports = new String[] {"websocket"};
    options.reconnection = false;
    options.timeout = 10000; // 10 seconds

    Socket socket = IO.socket(uri, options);

    CountDownLatch connectLatch = new CountDownLatch(1);
    CountDownLatch messageLatch = new CountDownLatch(1);
    final String[] receivedMessage = new String[1];

    socket
        .on(
            Socket.EVENT_CONNECT,
            args -> {
              System.out.println("Connected to Socket.IO server");
              connectLatch.countDown();
            })
        .on(
            "csvImportChannel",
            args -> {
              String[] msg = new String[1];
              msg[0] = (String) args[0];
              CSVImportMessage receivedCsvImportMessage =
                  JsonUtils.readValue(msg[0], CSVImportMessage.class);
              System.out.println("Received message: " + receivedMessage[0]);
              if (Objects.equals(receivedCsvImportMessage.getStatus(), "COMPLETED")
                  || Objects.equals(receivedCsvImportMessage.getStatus(), "FAILED")) {
                receivedMessage[0] = msg[0];
                messageLatch.countDown();
                socket.disconnect();
              }
            })
        .on(
            Socket.EVENT_CONNECT_ERROR,
            args -> {
              System.err.println("Socket.IO connect error: " + args[0]);
              connectLatch.countDown();
              messageLatch.countDown();
            })
        .on(
            Socket.EVENT_DISCONNECT,
            args -> System.out.println("Disconnected from Socket.IO server"));

    socket.connect();
    if (!connectLatch.await(10, TimeUnit.SECONDS)) {
      fail("Could not connect to Socket.IO server");
    }
    String jobId = initiateImport(entityName, csv, dryRun);

    if (!messageLatch.await(45, TimeUnit.SECONDS)) {
      fail("Did not receive CSV import result via Socket.IO within the expected time.");
    }

    String receivedJson = receivedMessage[0];
    if (receivedJson == null) {
      fail("Received message is null.");
    }

    CSVImportMessage csvImportMessage = JsonUtils.readValue(receivedJson, CSVImportMessage.class);
    if ("COMPLETED".equals(csvImportMessage.getStatus())) {
      return JsonUtils.pojoToJson(csvImportMessage.getResult());
    } else if ("FAILED".equals(csvImportMessage.getStatus())) {
      fail("CSV import failed: " + csvImportMessage.getError());
    } else {
      fail("Unknown status received: " + csvImportMessage.getStatus());
    }
    return null;
  }

  protected UUID getAdminUserId() throws HttpResponseException {
    UserResourceTest userResourceTest = new UserResourceTest();
    User adminUser = userResourceTest.getEntityByName("admin", ADMIN_AUTH_HEADERS);
    return adminUser.getId();
  }

  protected String initiateExport(String entityName) throws IOException {
    WebTarget target = getResourceByName(entityName + "/exportAsync");
    CSVExportResponse response =
        getWithResponse(
            target, CSVExportResponse.class, ADMIN_AUTH_HEADERS, Status.ACCEPTED.getStatusCode());
    return response.getJobId();
  }

  protected String initiateImport(String entityName, String csv, boolean dryRun)
      throws IOException {
    WebTarget target = getResourceByName(entityName + "/importAsync");
    target = !dryRun ? target.queryParam("dryRun", false) : target;
    CSVImportResponse response =
        putCsv(target, csv, CSVImportResponse.class, OK, ADMIN_AUTH_HEADERS);
    return response.getJobId();
  }

  @SneakyThrows
  protected void importCsvAndValidate(
      String entityName,
      List<CsvHeader> csvHeaders,
      List<String> createRecords,
      List<String> updateRecords) {
    createRecords = listOrEmpty(createRecords);
    updateRecords = listOrEmpty(updateRecords);

    String csv = EntityCsvTest.createCsv(csvHeaders, createRecords, updateRecords);

    CsvImportResult dryRunResultAsync =
        JsonUtils.readValue(
            receiveCsvImportViaSocketIO(entityName, csv, true), CsvImportResult.class);
    CsvImportResult dryRunResultSync = importCsv(entityName, csv, true);

    // Validate the imported result summary - it should include both created and updated records
    int totalRows = 1 + createRecords.size() + updateRecords.size();
    assertSummary(dryRunResultSync, ApiStatus.SUCCESS, totalRows, totalRows, 0);
    assertSummary(dryRunResultAsync, ApiStatus.SUCCESS, totalRows, totalRows, 0);
    String expectedResultsCsv =
        EntityCsvTest.createCsvResult(csvHeaders, createRecords, updateRecords);
    assertEquals(expectedResultsCsv, dryRunResultSync.getImportResultsCsv());
    assertEquals(expectedResultsCsv, dryRunResultAsync.getImportResultsCsv());

    CsvImportResult finalResultAsync =
        JsonUtils.readValue(
            receiveCsvImportViaSocketIO(entityName, csv, false), CsvImportResult.class);
    CsvImportResult finalResultSync = importCsv(entityName, csv, false);

    assertEquals(dryRunResultAsync.withDryRun(false), finalResultAsync);
    // entities have created in the earlier sync import (dryRun=false) so the next import agan will
    // have entities updated
    assertEquals(
        dryRunResultSync
            .withImportResultsCsv(
                dryRunResultSync.getImportResultsCsv().replace("Entity created", "Entity updated"))
            .withDryRun(false),
        finalResultSync);

    // Finally, export CSV and ensure the exported CSV is the same as imported CSV
    String exportedCsvAsync = receiveCsvViaSocketIO(entityName);
    CsvUtilTest.assertCsv(csv, exportedCsvAsync);
    String exportedCsvSync = exportCsv(entityName);
    CsvUtilTest.assertCsv(csv, exportedCsvSync);
  }

  protected void testImportExport(
      String entityName,
      List<CsvHeader> csvHeaders,
      List<String> createRecords,
      List<String> updateRecords,
      List<String> newRecords) {
    // Create new records
    importCsvAndValidate(entityName, csvHeaders, createRecords, null); // Dry run

    // Update created records with changes
    importCsvAndValidate(entityName, csvHeaders, null, updateRecords);

    // Add additional new records to the existing ones
    importCsvAndValidate(entityName, csvHeaders, newRecords, updateRecords);
  }

  protected CsvDocumentation getCsvDocumentation() throws HttpResponseException {
    WebTarget target = getCollection().path("/documentation/csv");
    return get(target, CsvDocumentation.class, ADMIN_AUTH_HEADERS);
  }

  public T assertOwnerInheritance(K createRequest, EntityReference expectedOwner)
      throws HttpResponseException {
    // Create entity with no owner and ensure it inherits owner from the parent
    createRequest.setOwners(null);
    T entity = createEntity(createRequest, ADMIN_AUTH_HEADERS);
    assertReferenceList(List.of(expectedOwner), entity.getOwners()); // Inherited owner
    entity = getEntity(entity.getId(), "owners", ADMIN_AUTH_HEADERS);
    assertReferenceList(List.of(expectedOwner), entity.getOwners()); // Inherited owner
    for (EntityReference owner : entity.getOwners()) {
      assertTrue(owner.getInherited());
    }
    entity = getEntityByName(entity.getFullyQualifiedName(), "owners", ADMIN_AUTH_HEADERS);
    assertReferenceList(List.of(expectedOwner), entity.getOwners()); // Inherited owner
    for (EntityReference owner : entity.getOwners()) {
      assertTrue(owner.getInherited());
    }
    return entity;
  }

  public void assertOwnershipInheritanceOverride(
      T entity, K updateRequest, EntityReference newOwner) throws HttpResponseException {
    // When an entity has ownership set, it does not inherit owner from the parent
    String json = JsonUtils.pojoToJson(entity);
    entity.setOwners(List.of(newOwner));
    entity = patchEntity(entity.getId(), json, entity, ADMIN_AUTH_HEADERS);
    assertReferenceList(List.of(newOwner), entity.getOwners());
    for (EntityReference owner : entity.getOwners()) {
      assertNull(owner.getInherited());
    }
    // Now simulate and ingestion entity update with no owner
    updateRequest.setOwners(null);
    entity = updateEntity(updateRequest, OK, ADMIN_AUTH_HEADERS);
    assertReferenceList(List.of(newOwner), entity.getOwners());
    entity = getEntity(entity.getId(), "owners", ADMIN_AUTH_HEADERS);
    assertReferenceList(List.of(newOwner), entity.getOwners());
    for (EntityReference owner : entity.getOwners()) {
      assertNull(owner.getInherited());
    }
    entity = getEntityByName(entity.getFullyQualifiedName(), "owners", ADMIN_AUTH_HEADERS);
    assertReferenceList(List.of(newOwner), entity.getOwners()); // Owner remains the same
    for (EntityReference owner : entity.getOwners()) {
      assertNull(owner.getInherited());
    }
  }

  public T assertSingleDomainInheritance(K createRequest, EntityReference expectedDomain)
      throws IOException {
    createRequest.setDomains(null);
    T entity = createEntity(createRequest, ADMIN_AUTH_HEADERS);
    assertReference(expectedDomain, entity.getDomains().get(0));
    entity = getEntity(entity.getId(), "domains", ADMIN_AUTH_HEADERS);
    assertReference(expectedDomain, entity.getDomains().get(0));
    assertTrue(entity.getDomains().get(0).getInherited());
    entity = getEntityByName(entity.getFullyQualifiedName(), "domains", ADMIN_AUTH_HEADERS);
    assertReference(expectedDomain, entity.getDomains().get(0));
    assertTrue(entity.getDomains().get(0).getInherited());
    assertEntityReferenceFromSearch(entity, expectedDomain, Entity.FIELD_DOMAINS);
    return entity;
  }

  public T assertMultipleDomainInheritance(K createRequest, List<EntityReference> expectedDomains)
      throws IOException {
    createRequest.setDomains(null);
    T entity = createEntity(createRequest, ADMIN_AUTH_HEADERS);

    // Verify all expected domains are inherited
    assertEquals(expectedDomains.size(), entity.getDomains().size());
    for (int i = 0; i < expectedDomains.size(); i++) {
      assertReference(expectedDomains.get(i), entity.getDomains().get(i));
      assertTrue(entity.getDomains().get(i).getInherited());
    }

    // Test entity retrieval by ID
    entity = getEntity(entity.getId(), "domains", ADMIN_AUTH_HEADERS);
    assertEquals(expectedDomains.size(), entity.getDomains().size());
    for (int i = 0; i < expectedDomains.size(); i++) {
      assertReference(expectedDomains.get(i), entity.getDomains().get(i));
      assertTrue(entity.getDomains().get(i).getInherited());
    }

    // Test entity retrieval by name
    entity = getEntityByName(entity.getFullyQualifiedName(), "domains", ADMIN_AUTH_HEADERS);
    assertEquals(expectedDomains.size(), entity.getDomains().size());
    for (int i = 0; i < expectedDomains.size(); i++) {
      assertReference(expectedDomains.get(i), entity.getDomains().get(i));
      assertTrue(entity.getDomains().get(i).getInherited());
    }

    return entity;
  }

  public void assertSingleDomainInheritanceOverride(
      T entity, K updateRequest, EntityReference newDomain) throws IOException {
    // When an entity has domain set, it does not inherit domain from the parent
    String json = JsonUtils.pojoToJson(entity);
    entity.setDomains(List.of(newDomain));
    entity = patchEntity(entity.getId(), json, entity, ADMIN_AUTH_HEADERS);
    assertReference(newDomain, entity.getDomains().get(0));
    assertNull(entity.getDomains().get(0).getInherited());

    // Now simulate and ingestion entity update with no domain
    updateRequest.setDomains(null);
    entity = updateEntity(updateRequest, OK, ADMIN_AUTH_HEADERS);
    assertReference(newDomain, entity.getDomains().get(0)); // Domain remains the same
    entity = getEntity(entity.getId(), "domains", ADMIN_AUTH_HEADERS);
    assertReference(newDomain, entity.getDomains().get(0)); // Domain remains the same
    assertNull(entity.getDomains().get(0).getInherited());
    entity = getEntityByName(entity.getFullyQualifiedName(), "domains", ADMIN_AUTH_HEADERS);
    assertReference(newDomain, entity.getDomains().get(0)); // Domain remains the same
    assertNull(entity.getDomains().get(0).getInherited());
  }

  public void verifyOwnersInSearch(EntityReference entity, List<EntityReference> expectedOwners)
      throws IOException {
    RestClient searchClient = getSearchClient();
    String entityType = entity.getType();
    IndexMapping index = getSearchRepository().getIndexMapping(entityType);
    Request request =
        new Request(
            "GET",
            format("%s/_search", index.getIndexName(getSearchRepository().getClusterAlias())));
    String query =
        format(
            "{\"size\": 100, \"query\": {\"bool\": {\"must\": [{\"term\": {\"_id\": \"%s\"}}]}}}",
            entity.getId().toString());
    request.setJsonEntity(query);
    es.org.elasticsearch.client.Response response = searchClient.performRequest(request);
    String jsonString = EntityUtils.toString(response.getEntity());
    HashMap<String, Object> map =
        (HashMap<String, Object>) JsonUtils.readOrConvertValue(jsonString, HashMap.class);
    LinkedHashMap<String, Object> hits = (LinkedHashMap<String, Object>) map.get("hits");
    ArrayList<LinkedHashMap<String, Object>> hitsList =
        (ArrayList<LinkedHashMap<String, Object>>) hits.get("hits");
    assertEquals(expectedOwners.size(), hitsList.size());
    LinkedHashMap<String, Object> source =
        (LinkedHashMap<String, Object>) hitsList.get(0).get("_source");
    List<EntityReference> owners = extractEntities(source, "owners");
    assertReferenceList(expectedOwners, owners);
  }

  public void verifyDomainsInSearch(EntityReference entity, List<EntityReference> expectedDomains)
      throws IOException {
    RestClient searchClient = getSearchClient();
    String entityType = entity.getType();
    IndexMapping index = getSearchRepository().getIndexMapping(entityType);
    Request request =
        new Request(
            "GET",
            format("%s/_search", index.getIndexName(getSearchRepository().getClusterAlias())));
    String query =
        format(
            "{\"size\": 100, \"query\": {\"bool\": {\"must\": [{\"term\": {\"_id\": \"%s\"}}]}}}",
            entity.getId().toString());
    request.setJsonEntity(query);
    es.org.elasticsearch.client.Response response = searchClient.performRequest(request);
    String jsonString = EntityUtils.toString(response.getEntity());
    HashMap<String, Object> map =
        (HashMap<String, Object>) JsonUtils.readOrConvertValue(jsonString, HashMap.class);
    LinkedHashMap<String, Object> hits = (LinkedHashMap<String, Object>) map.get("hits");
    ArrayList<LinkedHashMap<String, Object>> hitsList =
        (ArrayList<LinkedHashMap<String, Object>>) hits.get("hits");
    assertEquals(1, hitsList.size());
    LinkedHashMap<String, Object> source =
        (LinkedHashMap<String, Object>) hitsList.get(0).get("_source");
    List<EntityReference> domains =
        JsonUtils.convertObjects(source.get("domains"), EntityReference.class);
    assertReferenceList(expectedDomains, domains);
  }

  private List<EntityReference> extractEntities(
      LinkedHashMap<String, Object> source, String field) {
    List<LinkedHashMap<String, Object>> ownersList =
        (List<LinkedHashMap<String, Object>>) source.get(field);
    List<EntityReference> owners = new ArrayList<>();
    for (LinkedHashMap<String, Object> ownerMap : ownersList) {
      EntityReference owner = JsonUtils.convertValue(ownerMap, EntityReference.class);
      owners.add(owner);
    }
    return owners;
  }

  public static void assertLifeCycle(LifeCycle expected, LifeCycle actual) {
    if (expected == null) {
      assertNull(actual);
      return;
    }
    if (expected.getAccessed() != null) {
      assertEquals(expected.getAccessed().getTimestamp(), actual.getAccessed().getTimestamp());
      if (expected.getAccessed().getAccessedBy() != null) {
        assertReference(
            expected.getAccessed().getAccessedBy(),
            JsonUtils.convertValue(actual.getAccessed().getAccessedBy(), EntityReference.class));
      }
      assertEquals(
          expected.getAccessed().getAccessedByAProcess(),
          actual.getAccessed().getAccessedByAProcess());
    }
    if (expected.getCreated() != null) {
      assertEquals(expected.getCreated().getTimestamp(), actual.getCreated().getTimestamp());
      if (expected.getCreated().getAccessedBy() != null) {
        assertReference(
            expected.getCreated().getAccessedBy(),
            JsonUtils.convertValue(actual.getCreated().getAccessedBy(), EntityReference.class));
      }
      assertEquals(
          expected.getCreated().getAccessedByAProcess(),
          actual.getCreated().getAccessedByAProcess());
    }
    if (expected.getUpdated() != null) {
      assertEquals(expected.getUpdated().getTimestamp(), actual.getUpdated().getTimestamp());
      if (expected.getUpdated().getAccessedBy() != null) {
        assertReference(
            expected.getUpdated().getAccessedBy(),
            JsonUtils.convertValue(actual.getUpdated().getAccessedBy(), EntityReference.class));
        assertEquals(
            expected.getUpdated().getAccessedByAProcess(),
            actual.getUpdated().getAccessedByAProcess());
      }
    }
  }

  protected List<CsvHeader> getDatabaseCsvHeaders(Database db, boolean recursive) {
    return new DatabaseRepository.DatabaseCsv(db, "admin", recursive).HEADERS;
  }

  protected List<CsvHeader> getDatabaseServiceCsvHeaders(
      DatabaseService dbService, boolean recursive) {
    return new DatabaseServiceRepository.DatabaseServiceCsv(dbService, "admin", recursive).HEADERS;
  }

  protected List<CsvHeader> getDatabaseSchemaCsvHeaders(
      DatabaseSchema dbSchema, boolean recursive) {
    return new DatabaseSchemaRepository.DatabaseSchemaCsv(dbSchema, "admin", recursive).HEADERS;
  }

  public UpdateType getChangeType() {
    return MINOR_UPDATE;
  }
}
