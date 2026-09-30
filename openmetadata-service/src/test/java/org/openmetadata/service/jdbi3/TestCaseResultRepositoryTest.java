package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.service.jdbi3.TestCaseResultRepository.OperationType;

class TestCaseResultRepositoryTest {

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
  void aWriteMakesTheWrittenResultCurrent() {
    TestCaseResult changed = result(10);

    assertSame(
        changed,
        TestCaseResultRepository.currentResultAfter(changed, changed, OperationType.CREATE));
    assertSame(
        changed,
        TestCaseResultRepository.currentResultAfter(changed, changed, OperationType.UPDATE));
  }

  @Test
  void aDeleteFallsBackToTheNewestRemainingResult() {
    TestCaseResult previous = result(5);

    assertSame(
        previous,
        TestCaseResultRepository.currentResultAfter(result(10), previous, OperationType.DELETE));
    assertNull(TestCaseResultRepository.currentResultAfter(result(10), null, OperationType.DELETE));
  }
}
