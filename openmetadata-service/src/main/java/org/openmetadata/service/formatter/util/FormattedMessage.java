/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.formatter.util;

import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.openmetadata.schema.entity.feed.FeedInfo;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;

/** Internal formatter state for rendering entity change notifications. */
@Getter
@Setter
@NoArgsConstructor
public class FormattedMessage {
  private UUID id;
  private String about;
  private EntityReference entityRef;
  private String entityUrlLink;
  private List<UUID> domains;
  private CardStyle cardStyle = CardStyle.DEFAULT;
  private FieldOperation fieldOperation = FieldOperation.UPDATED;
  private FeedInfo feedInfo;
  private Long updatedAt;
  private String updatedBy;
  private ChangeDescription changeDescription;
  private String impersonatedBy;
  private String message;

  public FormattedMessage withId(UUID value) {
    id = value;
    return this;
  }

  public FormattedMessage withAbout(String value) {
    about = value;
    return this;
  }

  public FormattedMessage withEntityRef(EntityReference value) {
    entityRef = value;
    return this;
  }

  public FormattedMessage withEntityUrlLink(String value) {
    entityUrlLink = value;
    return this;
  }

  public FormattedMessage withDomains(List<UUID> value) {
    domains = value;
    return this;
  }

  public FormattedMessage withCardStyle(CardStyle value) {
    cardStyle = value;
    return this;
  }

  public FormattedMessage withFieldOperation(FieldOperation value) {
    fieldOperation = value;
    return this;
  }

  public FormattedMessage withFeedInfo(FeedInfo value) {
    feedInfo = value;
    return this;
  }

  public FormattedMessage withUpdatedAt(Long value) {
    updatedAt = value;
    return this;
  }

  public FormattedMessage withUpdatedBy(String value) {
    updatedBy = value;
    return this;
  }

  public FormattedMessage withMessage(String value) {
    message = value;
    return this;
  }

  public enum CardStyle {
    DEFAULT,
    LOGICAL_TEST_CASE_ADDED,
    ENTITY_CREATED,
    ENTITY_DELETED,
    ENTITY_SOFT_DELETED,
    DESCRIPTION,
    TAGS,
    OWNER,
    TEST_CASE_RESULT,
    CUSTOM_PROPERTIES,
    ASSETS,
    DOMAIN
  }

  public enum FieldOperation {
    ADDED("added"),
    UPDATED("updated"),
    DELETED("deleted"),
    NONE("none");

    private final String value;

    FieldOperation(String value) {
      this.value = value;
    }

    public String value() {
      return value;
    }
  }
}
