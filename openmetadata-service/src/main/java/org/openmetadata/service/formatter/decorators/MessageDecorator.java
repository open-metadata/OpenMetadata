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
import static org.openmetadata.service.events.subscription.AlertsRuleEvaluator.getConversation;
import static org.openmetadata.service.events.subscription.AlertsRuleEvaluator.getEntity;
import static org.openmetadata.service.formatter.entity.IngestionPipelineFormatter.getDataContractUrl;
import static org.openmetadata.service.formatter.entity.IngestionPipelineFormatter.getIngestionPipelineUrl;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedList;
import java.util.Optional;
import lombok.SneakyThrows;
import org.apache.commons.lang3.StringUtils;
import org.bitbucket.cowwoc.diffmatchpatch.DiffMatchPatch;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.feed.Conversation;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.branding.MessageBrandingResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public interface MessageDecorator<T> {
  Logger LOG = LoggerFactory.getLogger(MessageDecorator.class);

  default String getConnectionTestDescription() {
    return "This is a test message, receiving this message confirms that you have successfully configured "
        + MessageBrandingResolver.get().getProductName()
        + " to receive alerts.";
  }

  default String getProductName() {
    return MessageBrandingResolver.get().getProductName();
  }

  default String getLogoUrl() {
    return MessageBrandingResolver.get().getLogoUrl();
  }

  String getBold();

  String getBoldWithSpace();

  default String bold(String text) {
    return String.format(getBold(), text);
  }

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

  String getEntityUrl(String prefix, String fqn, String additionalInput);

  T buildTestMessage();

  @SneakyThrows
  default String buildEntityUrl(String entityType, EntityInterface entityInterface) {
    String fqn = resolveFullyQualifiedName(entityType, entityInterface);
    String entityUrl = "";
    switch (entityType) {
      case Entity.TEST_CASE:
        if (entityInterface instanceof TestCase testCase) {
          entityUrl =
              getEntityUrl("test-case", testCase.getFullyQualifiedName(), "test-case-results");
        }
        break;

      case Entity.GLOSSARY_TERM:
        entityUrl = getEntityUrl(Entity.GLOSSARY, fqn, "");
        break;

      case Entity.TAG:
        entityUrl = getEntityUrl("tags", fqn.split("\\.")[0], "");
        break;

      case Entity.USER:
        entityUrl = getEntityUrl("users", fqn, "");
        break;

      case Entity.TEAM:
        entityUrl = getEntityUrl("settings/members/teams", fqn, "");
        break;

      case Entity.INGESTION_PIPELINE:
        entityUrl = getIngestionPipelineUrl(this, entityType, entityInterface);
        break;

      case Entity.DATA_CONTRACT:
        entityUrl = getDataContractUrl(this, entityType, entityInterface);
        break;

      default:
        entityUrl = getEntityUrl(entityType, fqn, "");
    }

    LOG.debug("buildEntityUrl for Alert: {}", entityUrl);
    return entityUrl;
  }

  // Helper function to resolve FQN if null or empty
  private String resolveFullyQualifiedName(String entityType, EntityInterface entityInterface) {
    String fqn = entityInterface.getFullyQualifiedName();
    if (CommonUtil.nullOrEmpty(fqn)) {
      EntityInterface result =
          Entity.getEntity(entityType, entityInterface.getId(), "id", Include.NON_DELETED);
      fqn = result.getFullyQualifiedName();
    }
    return fqn;
  }

  static String getFQNForChangeEventEntity(ChangeEvent event) {
    return Optional.ofNullable(event.getEntityFullyQualifiedName())
        .filter(fqn -> !CommonUtil.nullOrEmpty(fqn))
        .orElseGet(
            () -> {
              if (event.getEntityType().equals(Entity.CONVERSATION)) {
                Conversation conversation = getConversation(event);
                return nullOrEmpty(conversation.getEntityRef())
                    ? conversation.getId().toString()
                    : conversation.getEntityRef().getFullyQualifiedName();
              } else {
                EntityInterface entityInterface = getEntity(event);
                return entityInterface.getFullyQualifiedName();
              }
            });
  }

  default T buildOutgoingTestMessage() {
    return buildTestMessage();
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

  static String getDateString(long epochTimestamp) {
    Instant instant = Instant.ofEpochSecond(epochTimestamp);
    return getDateString(instant);
  }

  static String getDateStringEpochMilli(long epochTimestamp) {
    Instant instant = Instant.ofEpochMilli(epochTimestamp);
    return getDateString(instant);
  }

  private static String getDateString(Instant instant) {
    LocalDateTime localDateTime = LocalDateTime.ofInstant(instant, ZoneId.systemDefault());

    // Format LocalDateTime to a specific date and time format
    DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    return localDateTime.format(formatter);
  }
}
