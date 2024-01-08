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

package org.openmetadata.service.formatter.entity;

import static org.openmetadata.service.formatter.util.FormatterUtil.transformMessage;

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.formatter.util.FormatterUtil;
import org.openmetadata.service.resources.feeds.MessageParser;

public class TestCaseFormatter implements EntityFormatter {
  private static final String TEST_RESULT_FIELD = "testCaseResult";

  @Override
  public String format(
      MessageDecorator<?> messageFormatter,
      FieldChange fieldChange,
      EntityInterface entity,
      FormatterUtil.CHANGE_TYPE changeType) {
    if (TEST_RESULT_FIELD.equals(fieldChange.getName())) {
      return transformTestCaseResult(messageFormatter, fieldChange, entity);
    }
    return transformMessage(messageFormatter, fieldChange, entity, changeType);
  }

  private String transformTestCaseResult(
      MessageDecorator<?> messageFormatter, FieldChange fieldChange, EntityInterface entity) {
    String testCaseName = entity.getName();
    TestCaseResult result = (TestCaseResult) fieldChange.getNewValue();
    TestCase testCaseEntity = (TestCase) entity;
    if (result != null) {
      String format =
          String.format(
              "Test Case %s is %s in %s",
              messageFormatter.getBold(),
              messageFormatter.getBold(),
              MessageParser.EntityLink.parse(testCaseEntity.getEntityLink()).getEntityFQN());
      return String.format(format, testCaseName, getStatusMessage(result.getTestCaseStatus()));
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

  private String getStatusMessage(TestCaseStatus status) {
    return switch (status) {
      case Success -> "<span style=\"color:#48CA9E\">Passed</span>";
      case Failed -> "<span style=\"color:#F24822\">Failed</span>";
      case Aborted -> "<span style=\"color:#FFBE0E\">Aborted</span>";
      case Queued -> "<span style=\"color:#959595\">Queued</span>";
    };
  }
}
