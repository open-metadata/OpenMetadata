package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TestCaseResultRepository.OperationType;

class TestCaseResultRepositoryTest {

  private static final String FQN = "svc.db.schema.table.row_count";

  private static TestCaseResult result(long timestamp) {
    return new TestCaseResult().withTimestamp(timestamp).withTestCaseStatus(TestCaseStatus.Success);
  }

  @Test
  void aResultIsCurrentWhenNothingNewerIsStored() {
    assertTrue(TestCaseResultRepository.isCurrentResult(result(10), null));
    assertTrue(TestCaseResultRepository.isCurrentResult(result(10), result(5)));
    assertTrue(TestCaseResultRepository.isCurrentResult(result(10), result(10)));
  }

  @Test
  void anOlderResultIsNotCurrent() {
    assertFalse(TestCaseResultRepository.isCurrentResult(result(5), result(10)));
  }

  @Test
  void theTestCaseIsSnapshottedBeforeItsNewestResultIsRead() {
    // A newer result stored after the snapshot must make the optimistic update conflict. Reading
    // the
    // newest result first would let an older write pass the version check and overwrite it.
    List<String> calls = new ArrayList<>();
    TestCaseResultRepository repository =
        mock(TestCaseResultRepository.class, Mockito.CALLS_REAL_METHODS);
    doAnswer(
            invocation -> {
              calls.add("newest result");
              return result(20);
            })
        .when(repository)
        .getLatestRecord(FQN);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class)) {
      entity
          .when(() -> Entity.getEntityByName(eq(Entity.TEST_CASE), eq(FQN), anyString(), any()))
          .thenAnswer(
              invocation -> {
                calls.add("test case");
                return new TestCase();
              });

      repository.syncTestCaseStatus(result(10).withTestCaseFQN(FQN), OperationType.CREATE, true);
    }

    assertEquals(List.of("test case", "newest result"), calls);
  }
}
