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

package org.openmetadata.service.formatter.decorators;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.events.subscription.AlertUtil.convertInputListToString;
import static org.openmetadata.service.events.subscription.AlertsRuleEvaluator.getEntity;
import static org.openmetadata.service.events.subscription.AlertsRuleEvaluator.getThread;
import static org.openmetadata.service.resources.feeds.MessageParser.replaceEntityLinks;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;
import org.apache.commons.lang3.StringUtils;
import org.bitbucket.cowwoc.diffmatchpatch.DiffMatchPatch;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.FeedUtils;

public interface MessageDecorator<T> {
  String getBold();

  String getLineBreak();

  String getAddMarker();

  String getAddMarkerClose();

  String getRemoveMarker();

  default String httpAddMarker() {
    return "<!add>";
  }

  default String httpRemoveMarker() {
    return "<!remove>";
  }

  String getRemoveMarkerClose();

  String getEntityUrl(String entityType, String fqn, String additionalInput);

  T buildEntityMessage(ChangeEvent event);

  T buildThreadMessage(ChangeEvent event);

  default String buildEntityUrl(String entityType, EntityInterface entityInterface) {
    String fqn = entityInterface.getFullyQualifiedName();
    if (CommonUtil.nullOrEmpty(fqn)) {
      EntityInterface result =
          Entity.getEntity(entityType, entityInterface.getId(), "id", Include.NON_DELETED);
      fqn = result.getFullyQualifiedName();
    }

    // Hande Test Case
    if (entityType.equals(Entity.TEST_CASE)) {
      TestCase testCase = (TestCase) entityInterface;
      MessageParser.EntityLink link = MessageParser.EntityLink.parse(testCase.getEntityLink());
      // TODO: this needs to be fixed no way to know the UI redirection
      return getEntityUrl(
          link.getEntityType(), link.getEntityFQN(), "profiler?activeTab=Data%20Quality");
    }

    return getEntityUrl(entityType, fqn, "");
  }

  default T buildOutgoingMessage(ChangeEvent event) {
    if (event.getEntityType().equals(Entity.THREAD)) {
      return buildThreadMessage(event);
    } else if (Entity.getEntityList().contains(event.getEntityType())) {
      return buildEntityMessage(event);
    } else {
      throw new IllegalArgumentException(
          "Cannot Build Message, Unsupported Entity Type: " + event.getEntityType());
    }
  }

  default String getPlaintextDiff(String oldValue, String newValue) {
    // create a configured DiffRowGenerator
    oldValue = oldValue == null ? StringUtils.EMPTY : oldValue;
    String addMarker = this.httpAddMarker();
    String removeMarker = this.httpRemoveMarker();

    DiffMatchPatch dmp = new DiffMatchPatch();
    LinkedList<DiffMatchPatch.Diff> diffs = dmp.diffMain(oldValue, newValue);
    dmp.diffCleanupSemantic(diffs);
    StringBuilder outputStr = new StringBuilder();
    for (DiffMatchPatch.Diff d : diffs) {
      if (DiffMatchPatch.Operation.EQUAL.equals(d.operation)) {
        // merging equal values of both string
        outputStr.append(d.text.trim()).append(" ");
      } else if (DiffMatchPatch.Operation.INSERT.equals(d.operation)) {
        // merging added values with addMarker before and after of new values added
        outputStr.append(addMarker).append(d.text.trim()).append(addMarker).append(" ");
      } else {
        // merging deleted values with removeMarker before and after of old value removed ..
        outputStr.append(removeMarker).append(d.text.trim()).append(removeMarker).append(" ");
      }
    }
    String diff = outputStr.toString().trim();
    // The additions and removals will be wrapped by <!add> and <!remove> tags
    // Replace them with html tags to render nicely in the UI
    // Example: This is a test <!remove>sentence<!remove><!add>line<!add>
    // This is a test <span class="diff-removed">sentence</span><span class="diff-added">line</span>
    diff = this.replaceMarkers(diff, addMarker, this.getAddMarker(), this.getAddMarkerClose());
    diff =
        this.replaceMarkers(
            diff, removeMarker, this.getRemoveMarker(), this.getRemoveMarkerClose());
    return diff;
  }

  default String replaceMarkers(String diff, String marker, String openTag, String closeTag) {
    int index = 0;
    while (diff.contains(marker)) {
      String replacement = index % 2 == 0 ? openTag : closeTag;
      diff = diff.replaceFirst(marker, replacement);
      index++;
    }
    return diff;
  }

  default OutgoingMessage createEntityMessage(ChangeEvent event) {
    OutgoingMessage message = new OutgoingMessage();
    message.setUserName(event.getUserName());
    EntityInterface entityInterface = getEntity(event);
    if (event.getEntity() != null) {
      String eventType;
      if (event.getEntity() instanceof TestCase) {
        eventType = "testSuite";
      } else {
        eventType = event.getEntityType();
      }
      String headerTxt;
      String headerText;
      if (eventType.equals(Entity.QUERY)) {
        headerTxt = "%s posted on " + eventType;
        headerText = String.format(headerTxt, event.getUserName());
      } else {
        String entityUrl = this.buildEntityUrl(event.getEntityType(), entityInterface);
        message.setEntityUrl(entityUrl);
        headerTxt = "%s posted on " + eventType + " %s";
        headerText = String.format(headerTxt, event.getUserName(), entityUrl);
      }
      message.setHeader(headerText);
    }
    List<Thread> thread = FeedUtils.getThreadWithMessage(this, event, "admin");
    List<String> messages = new ArrayList<>();
    thread.forEach(entry -> messages.add(entry.getMessage()));
    message.setMessages(messages);
    return message;
  }

  default OutgoingMessage createThreadMessage(ChangeEvent event) {
    OutgoingMessage message = new OutgoingMessage();
    message.setUserName(event.getUserName());
    Thread thread = getThread(event);
    String headerMessage = "";
    List<String> attachmentList = new ArrayList<>();
    switch (thread.getType()) {
      case Conversation -> {
        switch (event.getEventType()) {
          case THREAD_CREATED -> {
            headerMessage =
                String.format(
                    "@%s started a conversation for asset %s",
                    thread.getCreatedBy(), thread.getAbout());
            attachmentList.add(replaceEntityLinks(thread.getMessage()));
          }
          case POST_CREATED -> {
            headerMessage = String.format("@%s posted a message", thread.getCreatedBy());
            attachmentList.add(
                String.format(
                    "@%s : %s", thread.getCreatedBy(), replaceEntityLinks(thread.getMessage())));
            thread
                .getPosts()
                .forEach(
                    post ->
                        attachmentList.add(
                            String.format(
                                "@%s : %s",
                                post.getFrom(), replaceEntityLinks(post.getMessage()))));
          }
          case THREAD_UPDATED -> {
            headerMessage =
                String.format("@%s posted update on Conversation", thread.getUpdatedBy());
            attachmentList.add(replaceEntityLinks(thread.getMessage()));
          }
        }
      }
      case Task -> {
        switch (event.getEventType()) {
          case THREAD_CREATED -> {
            headerMessage =
                String.format(
                    "@%s created a Task with Id : %s",
                    thread.getCreatedBy(), thread.getTask().getId());
            attachmentList.add(String.format("Task Type : %s", thread.getTask().getType().value()));
            attachmentList.add(
                String.format(
                    "Assignees : %s",
                    convertInputListToString(
                        thread.getTask().getAssignees().stream()
                            .map(assignee -> String.format("@%s", assignee.getName()))
                            .toList())));
            attachmentList.add(String.format("Current Status : %s", thread.getTask().getStatus()));
          }
          case POST_CREATED -> {
            headerMessage =
                String.format(
                    "@%s posted a message on the Task with Id : %s",
                    thread.getCreatedBy(), thread.getTask().getId());
            thread
                .getPosts()
                .forEach(
                    post ->
                        attachmentList.add(
                            String.format(
                                "@%s : %s",
                                post.getFrom(), replaceEntityLinks(post.getMessage()))));
          }
          case THREAD_UPDATED -> {
            headerMessage =
                String.format(
                    "@%s posted update on the Task with Id : %s",
                    thread.getUpdatedBy(), thread.getTask().getId());
            attachmentList.add(String.format("Task Type : %s", thread.getTask().getType().value()));
            attachmentList.add(
                String.format(
                    "Assignees : %s",
                    convertInputListToString(
                        thread.getTask().getAssignees().stream()
                            .map(assignee -> String.format("@%s", assignee.getName()))
                            .toList())));
            attachmentList.add(String.format("Current Status : %s", thread.getTask().getStatus()));
          }
          case TASK_CLOSED -> {
            headerMessage =
                String.format(
                    "@%s closed Task with Id : %s",
                    thread.getCreatedBy(), thread.getTask().getId());
            attachmentList.add(String.format("Current Status : %s", thread.getTask().getStatus()));
          }
          case TASK_RESOLVED -> {
            headerMessage =
                String.format(
                    "@%s resolved Task with Id : %s",
                    thread.getCreatedBy(), thread.getTask().getId());
            attachmentList.add(String.format("Current Status : %s", thread.getTask().getStatus()));
          }
        }
      }
      case Announcement -> {
        switch (event.getEventType()) {
          case THREAD_CREATED -> {
            headerMessage =
                String.format("**@%s** posted an **Announcement**", thread.getCreatedBy());
            attachmentList.add(
                String.format("Description : %s", thread.getAnnouncement().getDescription()));
            attachmentList.add(
                String.format(
                    "Started At : %s", getDateString(thread.getAnnouncement().getStartTime())));
            attachmentList.add(
                String.format(
                    "Ends At : %s", getDateString(thread.getAnnouncement().getEndTime())));
          }
          case POST_CREATED -> {
            headerMessage =
                String.format(
                    "**@%s** posted a message on **Announcement**", thread.getCreatedBy());
            thread
                .getPosts()
                .forEach(
                    post ->
                        attachmentList.add(
                            String.format(
                                "@%s : %s",
                                post.getFrom(), replaceEntityLinks(post.getMessage()))));
          }
          case THREAD_UPDATED -> {
            headerMessage =
                String.format(
                    "**@%s** posted an update on  **Announcement**", thread.getUpdatedBy());
            attachmentList.add(
                String.format("Description : %s", thread.getAnnouncement().getDescription()));
            attachmentList.add(
                String.format(
                    "Started At : %s", getDateString(thread.getAnnouncement().getStartTime())));
            attachmentList.add(
                String.format(
                    "Ends At : %s", getDateString(thread.getAnnouncement().getEndTime())));
          }
        }
      }
    }
    if (nullOrEmpty(headerMessage) || attachmentList.isEmpty()) {
      throw new UnhandledServerException("Unable to build Slack Message");
    }
    message.setHeader(headerMessage);
    message.setMessages(attachmentList);
    return message;
  }

  private String getDateString(long epochTimestamp) {
    Instant instant = Instant.ofEpochSecond(epochTimestamp);
    LocalDateTime localDateTime = LocalDateTime.ofInstant(instant, ZoneId.systemDefault());

    // Format LocalDateTime to a specific date and time format
    DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    return localDateTime.format(formatter);
  }
}
