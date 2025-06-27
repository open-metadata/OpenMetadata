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

import static org.openmetadata.service.Entity.FIELD_TAGS;

import java.util.List;
import org.openmetadata.schema.entity.feed.FeedInfo;
import org.openmetadata.schema.entity.feed.TagFeedInfo;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.formatter.decorators.MessageDecorator;

public class TagFormatter extends DefaultFieldFormatter {
  private static final String HEADER_MESSAGE = "%s %s the tags for %s %s";

  public TagFormatter(
      MessageDecorator<?> messageDecorator, Thread thread, FieldChange fieldChange) {
    super(messageDecorator, thread, fieldChange);
  }

  @Override
  public String formatAddedField() {
    String message =
        this.getMessageDecorator().httpAddMarker()
            + this.getFieldNewValue()
            + this.getMessageDecorator().httpAddMarker();
    if (this.getEntityLink().getArrayFieldName() != null
        && this.getEntityLink().getArrayFieldValue() != null) {
      message =
          String.format(
              ("Added "
                  + this.getMessageDecorator().getBold()
                  + " to "
                  + getTransformedName(this.getEntityLink().getFieldName())
                  + " "
                  + this.getMessageDecorator().getBold()
                  + ": %s"),
              this.getEntityLink().getArrayFieldValue(),
              this.getEntityLink().getArrayFieldName(),
              message);

    } else {
      message =
          String.format(
              ("Added " + this.getMessageDecorator().getBold() + ": %s"),
              this.getFieldChangeName(),
              message);
    }
    String spanAdd = this.getMessageDecorator().getAddMarker();
    String spanAddClose = this.getMessageDecorator().getAddMarkerClose();
    if (message != null) {
      message =
          this.getMessageDecorator()
              .replaceMarkers(
                  message, this.getMessageDecorator().httpAddMarker(), spanAdd, spanAddClose);
    }
    populateTagFeedInfo(Thread.FieldOperation.ADDED, message);
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
    String spanAdd = this.getMessageDecorator().getAddMarker();
    String spanAddClose = this.getMessageDecorator().getAddMarkerClose();
    String spanRemove = this.getMessageDecorator().getRemoveMarker();
    String spanRemoveClose = this.getMessageDecorator().getRemoveMarkerClose();

    diff =
        this.getMessageDecorator()
            .replaceMarkers(
                diff, this.getMessageDecorator().httpAddMarker(), spanAdd, spanAddClose);
    diff =
        this.getMessageDecorator()
            .replaceMarkers(
                diff, this.getMessageDecorator().httpRemoveMarker(), spanRemove, spanRemoveClose);
    String message;
    if (this.getEntityLink().getArrayFieldName() != null
        && this.getEntityLink().getArrayFieldValue() != null) {
      message =
          String.format(
              ("Updated "
                  + this.getMessageDecorator().getBold()
                  + " of "
                  + getTransformedName(this.getEntityLink().getFieldName())
                  + " "
                  + this.getMessageDecorator().getBold()
                  + ": %s"),
              this.getEntityLink().getArrayFieldValue(),
              this.getEntityLink().getArrayFieldName(),
              diff);

    } else {
      message =
          String.format(
              ("Updated " + this.getMessageDecorator().getBold() + ": %s"),
              this.getFieldChangeName(),
              diff);
    }
    populateTagFeedInfo(Thread.FieldOperation.UPDATED, message);
    return String.format(message, this.getFieldChangeName());
  }

  @Override
  public String formatDeletedField() {
    String message =
        this.getMessageDecorator().httpRemoveMarker()
            + this.getFieldOldValue()
            + this.getMessageDecorator().httpRemoveMarker();
    if (this.getEntityLink().getArrayFieldName() != null
        && this.getEntityLink().getArrayFieldValue() != null) {
      message =
          String.format(
              ("Deleted "
                  + this.getMessageDecorator().getBold()
                  + " from "
                  + getTransformedName(this.getEntityLink().getFieldName())
                  + " "
                  + this.getMessageDecorator().getBold()
                  + ": %s"),
              this.getEntityLink().getArrayFieldValue(),
              this.getEntityLink().getArrayFieldName(),
              message);

    } else {
      message =
          String.format(
              ("Deleted " + this.getMessageDecorator().getBold() + ": %s"),
              this.getFieldChangeName(),
              message);
    }
    String spanAdd = this.getMessageDecorator().getRemoveMarker();
    String spanAddClose = this.getMessageDecorator().getRemoveMarkerClose();
    if (message != null) {
      message =
          this.getMessageDecorator()
              .replaceMarkers(
                  message, this.getMessageDecorator().httpRemoveMarker(), spanAdd, spanAddClose);
    }
    populateTagFeedInfo(Thread.FieldOperation.DELETED, message);
    return message;
  }

  private String getTransformedName(String fieldName) {
    if ("columns".equals(fieldName)) {
      return "column";
    }
    return fieldName;
  }

  private void populateTagFeedInfo(Thread.FieldOperation operation, String threadMessage) {
    List<TagLabel> oldTags =
        JsonUtils.readOrConvertValues(fieldChange.getOldValue(), TagLabel.class);
    List<TagLabel> newTags =
        JsonUtils.readOrConvertValues(fieldChange.getNewValue(), TagLabel.class);
    TagFeedInfo tagFeedInfo = new TagFeedInfo().withPreviousTags(oldTags).withUpdatedTags(newTags);
    FeedInfo feedInfo =
        new FeedInfo()
            .withHeaderMessage(getHeaderForTagsUpdate(operation.value()))
            .withFieldName(FIELD_TAGS)
            .withEntitySpecificInfo(tagFeedInfo);
    populateThreadFeedInfo(thread, threadMessage, Thread.CardStyle.TAGS, operation, feedInfo);
  }

  private String getHeaderForTagsUpdate(String eventTypeMessage) {
    return String.format(
        HEADER_MESSAGE,
        thread.getUpdatedBy(),
        eventTypeMessage,
        thread.getEntityRef().getType(),
        thread.getEntityUrlLink());
  }
}
