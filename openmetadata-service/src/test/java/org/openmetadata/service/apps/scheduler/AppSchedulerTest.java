package org.openmetadata.service.apps.scheduler;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;

@ExtendWith(MockitoExtension.class)
class AppSchedulerTest {

  private App testApp;
  private AppRunRecord testRunRecord;

  @BeforeEach
  void setUp() {
    testApp =
        new App()
            .withId(UUID.randomUUID())
            .withName("TestSearchIndexingApp")
            .withFullyQualifiedName("TestSearchIndexingApp");

    testRunRecord =
        new AppRunRecord()
            .withAppId(testApp.getId())
            .withAppName(testApp.getName())
            .withStartTime(System.currentTimeMillis())
            .withTimestamp(System.currentTimeMillis())
            .withRunType("Manual")
            .withStatus(AppRunRecord.Status.RUNNING);
  }

  @Test
  void testAppRunRecordStatusTransition() {
    assertEquals(AppRunRecord.Status.RUNNING, testRunRecord.getStatus());

    testRunRecord.withStatus(AppRunRecord.Status.STOPPED);
    assertEquals(AppRunRecord.Status.STOPPED, testRunRecord.getStatus());
  }

  @Test
  void testAppRunRecordEndTimeSet() {
    long endTime = System.currentTimeMillis();
    testRunRecord.withEndTime(endTime);

    assertNotNull(testRunRecord.getEndTime());
    assertEquals(endTime, testRunRecord.getEndTime());
  }
}
