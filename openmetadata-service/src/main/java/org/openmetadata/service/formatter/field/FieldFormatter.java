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

package org.openmetadata.service.formatter.field;

import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.formatter.util.FormatterUtil;
import org.openmetadata.service.resources.feeds.MessageParser;

public interface FieldFormatter {
  String getFieldChangeName();

  String getFieldOldValue();

  String getFieldNewValue();

  String getFormattedMessage(FormatterUtil.CHANGE_TYPE changeType);

  MessageDecorator<?> getMessageDecorator();

  MessageParser.EntityLink getEntityLink();

  String formatAddedField();

  String formatUpdatedField();

  String formatDeletedField();
}
