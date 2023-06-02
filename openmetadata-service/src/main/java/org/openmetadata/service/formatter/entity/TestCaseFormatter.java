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

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.formatter.util.FormatterUtil;
import org.openmetadata.service.resources.feeds.MessageParser;

public class TestCaseFormatter implements EntityFormatter {

  @Override
  public String format(
      MessageDecorator<?> messageFormatter,
      FieldChange fieldChange,
      EntityInterface entity,
      FormatterUtil.CHANGE_TYPE changeType) {
    String testCaseName = entity.getName();
    TestCaseResult result = (TestCaseResult) fieldChange.getNewValue();
    TestCase testCaseEntity = (TestCase) entity;
    if (result != null) {
      String format =
          String.format(
              "Test Case status for %s against table/column %s is %s in test suite %s",
              messageFormatter.getBold(),
              MessageParser.EntityLink.parse(testCaseEntity.getEntityLink()).getEntityFQN(),
              messageFormatter.getBold(),
              testCaseEntity.getTestSuite().getName());
      return String.format(format, testCaseName, result.getTestCaseStatus());
    }
    String format =
        String.format(
            "Test Case %s is updated in %s/%s",
            messageFormatter.getBold(),
            MessageParser.EntityLink.parse(testCaseEntity.getEntityLink()).getEntityFQN(),
            testCaseEntity.getTestSuite().getName());
    return String.format(format, testCaseName);
  }
}
