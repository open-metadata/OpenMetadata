package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

class AlertMatcherParityTest {

  @Test
  void eventBytesUnchangedAfterMatching() {
    ChangeEvent event = firstResultOfATestCase();
    String before = JsonUtils.pojoToJson(event);
    AlertsRuleEvaluator evaluator = new AlertsRuleEvaluator(event);

    boolean firstTrigger = evaluator.matchTestResult(List.of("Failed"));
    boolean secondTrigger = evaluator.matchTestResult(List.of("Failed", "Aborted"));

    assertTrue(firstTrigger);
    assertTrue(secondTrigger);
    assertEquals(before, JsonUtils.pojoToJson(event));
  }

  private static ChangeEvent firstResultOfATestCase() {
    TestCaseResult result =
        new TestCaseResult().withTestCaseStatus(TestCaseStatus.Failed).withTimestamp(1L);
    FieldChange added = new FieldChange().withName("testCaseResult").withNewValue(result);
    ChangeDescription change =
        new ChangeDescription()
            .withFieldsAdded(new ArrayList<>(List.of(added)))
            .withFieldsUpdated(new ArrayList<>());
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEntityType(Entity.TEST_CASE)
        .withEventType(EventType.ENTITY_UPDATED)
        .withChangeDescription(change);
  }
}
