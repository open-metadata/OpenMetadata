package org.openmetadata.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jobs.EnumCleanupHandler;
import org.openmetadata.service.jobs.JobDAO;
import org.openmetadata.service.jobs.JobHandler;
import org.openmetadata.service.jobs.JobHandlerRegistry;

@Slf4j
public class JobHandlerTest extends OpenMetadataApplicationTest {

  static JobHandlerRegistry registry;
  static JobDAO jobDAO;
  static EnumCleanupHandler enumCleanupHandler;

  @BeforeAll
  public static void setup() {
    registry = new JobHandlerRegistry();
    jobDAO = Entity.getJobDAO();
    enumCleanupHandler = new EnumCleanupHandler(Entity.getCollectionDAO());
    registry.register("EnumCleanupHandler", enumCleanupHandler);
  }

  @Test
  public void testRegisterEventHandler() {
    // Verify that the handler is registered
    JobHandler handler = registry.getHandler("EnumCleanupHandler");
    assertNotNull(handler);
    assertInstanceOf(EnumCleanupHandler.class, handler);

    Exception exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> {
              registry.getHandler("NonExistentHandler");
            });
    assertEquals("No handler registered for NonExistentHandler", exception.getMessage());
  }

  @Test
  public void testBackgroundJobTrigger() {

    String wrongJobArgs = "invalidArgs";
    Exception exception =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                Entity.getJobDAO()
                    .insertJob(
                        BackgroundJob.JobType.CUSTOM_PROPERTY_ENUM_CLEANUP,
                        new EnumCleanupHandler(Entity.getCollectionDAO()),
                        wrongJobArgs,
                        "admin"));
    assertEquals("jobArgs must be a valid JSON string", exception.getMessage());
  }
}
