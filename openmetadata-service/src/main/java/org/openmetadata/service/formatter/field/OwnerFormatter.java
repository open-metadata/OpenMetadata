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

import static org.openmetadata.service.Entity.FIELD_OWNERS;

import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.feed.FeedInfo;
import org.openmetadata.schema.entity.feed.OwnerFeedInfo;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.formatter.decorators.MessageDecorator;

public class OwnerFormatter extends DefaultFieldFormatter {
  private static final String HEADER_MESSAGE = "%s %s the owner for %s %s";

  public OwnerFormatter(
      MessageDecorator<?> messageDecorator, Thread thread, FieldChange fieldChange) {
    super(messageDecorator, thread, fieldChange);
  }

  @Override
  public String formatAddedField() {
    String message = super.formatAddedField();
    populateOwnerFeedInfo(Thread.FieldOperation.ADDED, message);
    return message;
  }

  @Override
  public String formatUpdatedField() {
    String diff =
        this.getMessageDecorator().httpRemoveMarker()
            + this.getFieldOldValue()
            + this.getMessageDecorator().httpRemoveMarker()
            + " changed to "
            + this.getMessageDecorator().httpAddMarker()
            + this.getFieldNewValue()
            + this.getMessageDecorator().httpAddMarker();
    diff =
        this.getMessageDecorator()
            .replaceMarkers(
                diff,
                this.getMessageDecorator().httpAddMarker(),
                this.getMessageDecorator().getAddMarker(),
                this.getMessageDecorator().getAddMarkerClose());
    diff =
        this.getMessageDecorator()
            .replaceMarkers(
                diff,
                this.getMessageDecorator().httpRemoveMarker(),
                this.getMessageDecorator().getRemoveMarker(),
                this.getMessageDecorator().getRemoveMarkerClose());
    if (!CommonUtil.nullOrEmpty(diff)) {
      String field = String.format("Updated %s: %s", this.getMessageDecorator().getBold(), diff);
      diff = String.format(field, this.getFieldChangeName());
    }
    populateOwnerFeedInfo(Thread.FieldOperation.UPDATED, diff);
    return diff;
  }

  @Override
  public String formatDeletedField() {
    String message = super.formatDeletedField();
    populateOwnerFeedInfo(Thread.FieldOperation.DELETED, message);
    return message;
  }

  private void populateOwnerFeedInfo(Thread.FieldOperation operation, String threadMessage) {
    OwnerFeedInfo ownerFeedInfo =
        new OwnerFeedInfo()
            .withPreviousOwner(
                JsonUtils.readOrConvertValues(fieldChange.getOldValue(), EntityReference.class))
            .withUpdatedOwner(
                JsonUtils.readOrConvertValues(fieldChange.getNewValue(), EntityReference.class));
    FeedInfo feedInfo =
        new FeedInfo()
            .withHeaderMessage(getHeaderForOwnerUpdate(operation.value()))
            .withFieldName(FIELD_OWNERS)
            .withEntitySpecificInfo(ownerFeedInfo);
    populateThreadFeedInfo(thread, threadMessage, Thread.CardStyle.OWNER, operation, feedInfo);
  }

  private String getHeaderForOwnerUpdate(String eventTypeMessage) {
    return String.format(
        HEADER_MESSAGE,
        thread.getUpdatedBy(),
        eventTypeMessage,
        thread.getEntityRef().getType(),
        thread.getEntityUrlLink());
  }
}
