package org.openmetadata.service.formatter.field;

import java.util.Optional;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.feed.FeedInfo;
import org.openmetadata.schema.entity.feed.TestCaseResultFeedInfo;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.formatter.decorators.EmailMessageDecorator;
import org.openmetadata.service.formatter.decorators.FeedMessageDecorator;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.jdbi3.TestCaseResultRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.ResultList;

public class TestCaseResultFormatter extends DefaultFieldFormatter {
  public static final String TEST_RESULT_FIELD = "testCaseResult";
  private static final String HEADER_MESSAGE = "%s added results to test Case %s";

  public TestCaseResultFormatter(
      MessageDecorator<?> messageDecorator, Thread thread, FieldChange fieldChange) {
    super(messageDecorator, thread, fieldChange);
  }

  @Override
  public String formatAddedField() {
    String message;
    if (fieldChangeName.equals(TEST_RESULT_FIELD)) {
      message = transformTestCaseResult(messageDecorator, thread, fieldChange);
    } else {
      message = super.formatAddedField();
    }
    // Update the thread with the required information
    populateTestResultFeedInfo(Thread.FieldOperation.UPDATED, message);
    return message;
  }

  @Override
  public String formatUpdatedField() {
    String message;
    if (fieldChangeName.equals(TEST_RESULT_FIELD)) {
      message = transformTestCaseResult(messageDecorator, thread, fieldChange);
    } else {
      message = super.formatUpdatedField();
    }
    // Update the thread with the required information
    populateTestResultFeedInfo(Thread.FieldOperation.UPDATED, message);
    return message;
  }

  private void populateTestResultFeedInfo(Thread.FieldOperation operation, String threadMessage) {
    long currentTime = System.currentTimeMillis();
    long lastWeekTime = currentTime - 7 * 24 * 60 * 60 * 1000;
    TestCaseResultRepository testCaseResultRepository =
        (TestCaseResultRepository) Entity.getEntityTimeSeriesRepository(Entity.TEST_CASE_RESULT);
    TestCase testCaseEntity =
        Entity.getEntity(
            thread.getEntityRef().getType(),
            thread.getEntityRef().getId(),
            "id,testSuite",
            Include.ALL);
    TestSuite testSuiteEntity = Entity.getEntity(testCaseEntity.getTestSuite(), "id", Include.ALL);
    ResultList<TestCaseResult> testCaseResultResultList =
        testCaseResultRepository.getTestCaseResults(
            testCaseEntity.getFullyQualifiedName(), lastWeekTime, currentTime);
    TestCaseResultFeedInfo testCaseResultFeedInfo =
        new TestCaseResultFeedInfo()
            .withTestCaseResult(testCaseResultResultList.getData())
            .withEntityTestResultSummary(testSuiteEntity.getTestCaseResultSummary())
            .withParameterValues(testCaseEntity.getParameterValues());
    FeedInfo feedInfo =
        new FeedInfo()
            .withHeaderMessage(getHeaderForTestResultUpdate())
            .withFieldName(TEST_RESULT_FIELD)
            .withEntitySpecificInfo(testCaseResultFeedInfo);
    populateThreadFeedInfo(
        thread, threadMessage, Thread.CardStyle.TEST_CASE_RESULT, operation, feedInfo);
  }

  private String getHeaderForTestResultUpdate() {
    return String.format(HEADER_MESSAGE, thread.getUpdatedBy(), thread.getEntityUrlLink());
  }

  private String transformTestCaseResult(
      MessageDecorator<?> messageFormatter, Thread thread, FieldChange fieldChange) {
    TestCase testCaseEntity =
        Entity.getEntity(
            thread.getEntityRef().getType(), thread.getEntityRef().getId(), "id", Include.ALL);
    String testCaseName =
        CommonUtil.nullOrEmpty(testCaseEntity.getDisplayName())
            ? testCaseEntity.getName()
            : testCaseEntity.getDisplayName();

    String testCaseDescription = Optional.ofNullable(testCaseEntity.getDescription()).orElse("");
    boolean hasDescription =
        (messageFormatter instanceof EmailMessageDecorator)
            && !CommonUtil.nullOrEmpty(testCaseDescription);

    TestCaseResult result = JsonUtils.convertValue(fieldChange.getNewValue(), TestCaseResult.class);
    if (result != null) {
      String format =
          String.format(
              "Test Case %s is %s in %s %s%s",
              messageFormatter.getBold(),
              messageFormatter.getBold(),
              MessageParser.EntityLink.parse(testCaseEntity.getEntityLink()).getEntityFQN(),
              hasDescription
                  ? messageFormatter.getLineBreak() + messageFormatter.getLineBreak()
                  : "",
              hasDescription ? "Test Case Description: %s" : "");
      return hasDescription
          ? String.format(
              format,
              testCaseName,
              getStatusMessage(messageFormatter, result.getTestCaseStatus()),
              testCaseDescription)
          : String.format(
              format, testCaseName, getStatusMessage(messageFormatter, result.getTestCaseStatus()));
    }
    String format =
        String.format(
            "Test Case %s is updated in %s",
            messageFormatter.getBold(), messageFormatter.getBold());
    return String.format(
        format,
        testCaseName,
        MessageParser.EntityLink.parse(testCaseEntity.getEntityLink()).getEntityFQN());
  }

  private String getStatusMessage(MessageDecorator<?> messageDecorator, TestCaseStatus status) {
    if (messageDecorator instanceof FeedMessageDecorator) {
      return switch (status) {
        case Success -> "<span style=\"color:#48CA9E\">Passed</span>";
        case Failed -> "<span style=\"color:#F24822\">Failed</span>";
        case Aborted -> "<span style=\"color:#FFBE0E\">Aborted</span>";
        case Queued -> "<span style=\"color:#959595\">Queued</span>";
      };
    } else {
      return switch (status) {
        case Success -> "Passed";
        case Failed -> "Failed";
        case Aborted -> "Aborted";
        case Queued -> "Queued";
      };
    }
  }
}
