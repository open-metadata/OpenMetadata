package org.openmetadata.jobs;

import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.jobs.GenericBackgroundWorker.NO_JOB_SLEEP_SECONDS;
import static org.openmetadata.service.security.SecurityUtil.getPrincipalName;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import java.security.SecureRandom;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.jobs.EnumCleanupArgs;
import org.openmetadata.schema.type.CustomPropertyConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jobs.BackgroundJobException;
import org.openmetadata.service.jobs.EnumCleanupHandler;
import org.openmetadata.service.jobs.GenericBackgroundWorker;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.jobs.JobHandler;
import org.openmetadata.service.jobs.JobHandlerRegistry;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.metadata.TypeResourceTest;

@Slf4j
public class BackgroundJobWorkerTest extends OpenMetadataApplicationTest {

  static JobHandlerRegistry registry;
  static JobDAO jobDAO;
  static CollectionDAO collectionDao;
  static EnumCleanupHandler enumCleanupHandler;
  public static TableResourceTest TABLE_RESOURCE_TEST;
  public static TypeResourceTest TYPE_RESOURCE_TEST;

  public static CustomProperty customPropertyMulti;
  public static CustomProperty customPropertySingle;
  public static GenericBackgroundWorker worker;

  public static Table TABLE4;

  @BeforeAll
  public static void setup(TestInfo test) throws Exception {
    registry = new JobHandlerRegistry();
    jobDAO = Entity.getJobDAO();
    collectionDao = Entity.getCollectionDAO();
    enumCleanupHandler = new EnumCleanupHandler(Entity.getCollectionDAO());
    LOG.info("Registering EnumCleanupHandler {}", enumCleanupHandler);
    registry.register("EnumCleanupHandler", enumCleanupHandler);
    TABLE_RESOURCE_TEST = new TableResourceTest();
    TABLE_RESOURCE_TEST.setup(test);
    TYPE_RESOURCE_TEST = new TypeResourceTest();
    Type enumType = TYPE_RESOURCE_TEST.getEntityByName("enum", "", ADMIN_AUTH_HEADERS);
    Type entityType =
        TYPE_RESOURCE_TEST.getEntityByName(Entity.TABLE, "customProperties", ADMIN_AUTH_HEADERS);

    customPropertySingle =
        new CustomProperty()
            .withName("tableEnumCpSingle")
            .withDescription("enum type custom property with multiselect = false")
            .withPropertyType(enumType.getEntityReference())
            .withCustomPropertyConfig(
                new CustomPropertyConfig()
                    .withConfig(
                        Map.of(
                            "values",
                            List.of("\"single5\"", "single1", "single2", "single3", "single4"),
                            "multiSelect",
                            false)));

    customPropertyMulti =
        new CustomProperty()
            .withName("tableEnumCpMulti")
            .withDescription("enum type custom property with multiselect = true")
            .withPropertyType(enumType.getEntityReference())
            .withCustomPropertyConfig(
                new CustomPropertyConfig()
                    .withConfig(
                        Map.of(
                            "values",
                            List.of("\"multi5\"", "multi1", "multi2", "multi3", "multi4"),
                            "multiSelect",
                            true)));
    CustomProperty[] customProperties = {customPropertySingle, customPropertyMulti};
    for (CustomProperty customProperty : customProperties) {
      TYPE_RESOURCE_TEST.addAndCheckCustomProperty(
          entityType.getId(), customProperty, OK, ADMIN_AUTH_HEADERS);
    }

    CreateTable createTable4 = TABLE_RESOURCE_TEST.createRequest(test);
    createTable4.withName("table4");
    TABLE4 = TABLE_RESOURCE_TEST.createAndCheckEntity(createTable4, ADMIN_AUTH_HEADERS);
  }

  private BackgroundJob createBackgroundJob(EnumCleanupArgs enumCleanupArgs) {
    BackgroundJob job = new BackgroundJob();
    job.setId(new SecureRandom().nextLong());
    job.setJobType(BackgroundJob.JobType.CUSTOM_PROPERTY_ENUM_CLEANUP);
    job.setJobArgs(JsonUtils.pojoToJson(enumCleanupArgs));
    job.setCreatedBy(getPrincipalName(ADMIN_AUTH_HEADERS));
    job.setMethodName("EnumCleanupHandler");
    return job;
  }

  @Test
  public final void testRegisterEventHandler() {
    EnumCleanupArgs enumCleanupArgs =
        new EnumCleanupArgs()
            .withPropertyName("name")
            .withRemovedEnumKeys(List.of())
            .withEntityType("type");

    BackgroundJob job = createBackgroundJob(enumCleanupArgs);

    // Verify that the handler is registered
    JobHandler handler = registry.getHandler(job);
    assertNotNull(handler);
    assertInstanceOf(EnumCleanupHandler.class, handler);

    // Verify that an exception is thrown for a non-existent handler
    job.setMethodName("NonExistentHandler");
    Exception exception =
        assertThrows(BackgroundJobException.class, () -> registry.getHandler(job));
    assertEquals("No handler registered for NonExistentHandler", exception.getMessage());
  }

  @Test
  public final void testBackgroundJobTriggerWithInvalidArgs() {
    BackgroundJob job = new BackgroundJob();
    job.setId(new SecureRandom().nextLong());
    job.setJobArgs("invalidArgs");
    job.setMethodName("EnumCleanupHandler");

    BackgroundJobException exception =
        assertThrows(BackgroundJobException.class, () -> enumCleanupHandler.runJob(job));
    assertEquals(
        "Failed to run EnumCleanupHandler job. Error:Invalid arguments invalidArgs",
        exception.getMessage());
  }

  @Test
  public final void testBackgroundJobTriggerWithUnrecognizedField() {
    EnumCleanupArgs enumCleanupArgs =
        new EnumCleanupArgs()
            .withPropertyName("name")
            .withRemovedEnumKeys(List.of())
            .withEntityType("type");

    BackgroundJob job = createBackgroundJob(enumCleanupArgs);
    job.setJobArgs(
        "{\"bucket\":\"value\",\"propertyName\":\"name\",\"removedEnumKeys\":[],\"entityType\":\"type\"}");

    BackgroundJobException exception =
        assertThrows(BackgroundJobException.class, () -> enumCleanupHandler.runJob(job));
    assertEquals(
        "Failed to run EnumCleanupHandler job. Error:Invalid arguments {\"bucket\":\"value\",\"propertyName\":\"name\",\"removedEnumKeys\":[],\"entityType\":\"type\"}",
        exception.getMessage());
  }

  @Test
  public final void testBackgroundJobTriggerWithValidArgs() {
    EnumCleanupArgs enumCleanupArgs =
        new EnumCleanupArgs()
            .withPropertyName(customPropertyMulti.getName())
            .withRemovedEnumKeys(List.of())
            .withEntityType("table");

    BackgroundJob job = createBackgroundJob(enumCleanupArgs);
    String jobArgs = JsonUtils.pojoToJson(enumCleanupArgs);

    long jobId =
        Entity.getJobDAO()
            .insertJob(
                job.getJobType(),
                new EnumCleanupHandler(collectionDao),
                jobArgs,
                job.getCreatedBy());
    Optional<BackgroundJob> fetchedJobOptional = Entity.getJobDAO().fetchJobById(jobId);
    assertTrue(fetchedJobOptional.isPresent(), "Job should be present");

    BackgroundJob fetchedJob = fetchedJobOptional.get();
    String fetchedJobArgs = JsonUtils.pojoToJson(fetchedJob.getJobArgs());

    // Assert the fetched job details
    assertEquals(job.getJobType(), fetchedJob.getJobType(), "Job type should match");
    assertEquals(job.getMethodName(), fetchedJob.getMethodName(), "Method name should match");

    EnumCleanupArgs actualArgs = JsonUtils.readValue(fetchedJobArgs, EnumCleanupArgs.class);
    assertEquals(enumCleanupArgs, actualArgs, "Job arguments should match");
    assertEquals(job.getCreatedBy(), fetchedJob.getCreatedBy(), "Created by should match");
  }

  @Test
  public final void testDelayedJobTrigger() throws InterruptedException {
    // Create a delayed job for enum cleanup
    EnumCleanupArgs enumCleanupArgs =
        new EnumCleanupArgs()
            .withPropertyName(customPropertyMulti.getName())
            .withRemovedEnumKeys(List.of())
            .withEntityType("table");
    String jobArgs = JsonUtils.pojoToJson(enumCleanupArgs);
    String createdBy = "admin";
    long delayInMillis = 100; // 100ms delay

    long jobId =
        Entity.getJobDAO()
            .insertJob(
                BackgroundJob.JobType.CUSTOM_PROPERTY_ENUM_CLEANUP,
                new EnumCleanupHandler(collectionDao),
                jobArgs,
                createdBy,
                System.currentTimeMillis() + delayInMillis);

    Optional<BackgroundJob> fetchedJobOptional = Entity.getJobDAO().fetchJobById(jobId);
    assertTrue(fetchedJobOptional.isPresent(), "Delayed job should be present");

    BackgroundJob fetchedJob = fetchedJobOptional.get();
    assertEquals(
        BackgroundJob.JobType.CUSTOM_PROPERTY_ENUM_CLEANUP,
        fetchedJob.getJobType(),
        "Job type should match");
    assertEquals("EnumCleanupHandler", fetchedJob.getMethodName(), "Method name should match");
    assertEquals(createdBy, fetchedJob.getCreatedBy(), "Created by should match");

    // Verify the job arguments
    EnumCleanupArgs actualArgs =
        JsonUtils.readValue(JsonUtils.pojoToJson(fetchedJob.getJobArgs()), EnumCleanupArgs.class);
    assertEquals(enumCleanupArgs, actualArgs, "Job arguments should match");

    // Verify job is not executed immediately
    Thread.sleep(delayInMillis - 50);
    Optional<BackgroundJob> jobAfterShortWait = Entity.getJobDAO().fetchJobById(jobId);
    assertTrue(jobAfterShortWait.isPresent(), "Job should still exist after short wait");
    assertEquals(
        BackgroundJob.Status.PENDING,
        jobAfterShortWait.get().getStatus(),
        "Job should not be completed yet");

    // Wait for the next run cycle
    Thread.sleep(delayInMillis + NO_JOB_SLEEP_SECONDS);
    Optional<BackgroundJob> jobAfterDelay = Entity.getJobDAO().fetchJobById(jobId);
    assertTrue(jobAfterDelay.isPresent(), "Job should still exist after delay");
    assertEquals(
        BackgroundJob.Status.COMPLETED, jobAfterDelay.get().getStatus(), "Job should be completed");
  }
}
