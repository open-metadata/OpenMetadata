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

package org.openmetadata.service.alerting.channel;

import com.fasterxml.jackson.core.JsonPointer;
import java.util.Map;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory;

/**
 * How a message names a destination and its fields to the person who configured them: by what
 * they see in the alert form, never by an id or a JSON path.
 */
final class DestinationLabels {
  private static final Map<String, String> CHANNEL_NAMES =
      Map.of(
          "MsTeams", "Microsoft Teams",
          "GChat", "Google Chat",
          "ActivityFeed", "Activity Feed",
          "GovernanceWorkflowChangeEvent", "Governance Workflow");
  private static final Map<String, String> FIELD_NAMES =
      Map.of(
          "/endpoint", "URL",
          "/authType/tokenUrl", "token URL",
          "/authType/secretKey", "secret key",
          "/authType/clientId", "client ID",
          "/authType/clientSecret", "client secret");
  private static final String HEADERS = "headers";
  private static final String RECEIVERS = "receivers";

  private DestinationLabels() {}

  /** "Webhook" for an external destination, "Owners (Slack)" for one that notifies people. */
  static String of(SubscriptionDestination destination) {
    String channel = channel(ChannelResolution.of(destination).channelId());
    SubscriptionCategory category = destination.getCategory();
    boolean external = category == null || category == SubscriptionCategory.EXTERNAL;
    return external ? channel : "%s (%s)".formatted(category.value(), channel);
  }

  static String channel(String channelId) {
    return CHANNEL_NAMES.getOrDefault(channelId, channelId);
  }

  /** "URL", "'Authorization' header", "client secret": the field as the form labels it. */
  static String field(JsonPointer field) {
    String path = field.toString();
    String head = field.getMatchingProperty();
    String label = FIELD_NAMES.get(path);
    if (label == null && HEADERS.equals(head)) {
      label = "'%s' header".formatted(field.tail().getMatchingProperty());
    }
    if (label == null && RECEIVERS.equals(head)) {
      label = RECEIVERS;
    }
    return label == null ? path : label;
  }
}
