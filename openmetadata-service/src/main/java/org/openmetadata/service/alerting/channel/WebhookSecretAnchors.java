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
import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.fernet.rotation.Anchor;
import org.openmetadata.service.fernet.rotation.BoundSecretAnchors;
import org.openmetadata.service.fernet.rotation.JsonDocument;

/**
 * Where the bound tokens of alert destinations and profile webhooks belong, through the owners' own
 * functions ({@link DestinationSecrets#ownerOf}, {@link DestinationSecrets#secretFieldsOf}, {@link
 * ProfileWebhookSecrets.Holder#ownerOf}, {@link WebhookSecrets#fieldsIn}), so the rotation and the
 * server cannot disagree about an owner or a field. A destination is any object with a UUID {@code
 * id}, a {@code type} and an object {@code config} that reads as a {@link SubscriptionDestination},
 * wherever a copy of it sits: the alert, its versions, its cached copy, or the destination lists its
 * change descriptions record. A profile webhook is a slot under an object field {@code
 * subscription}, owned by the user or the team whose document holds it; the token opens for one.
 */
@Slf4j
public final class WebhookSecretAnchors implements BoundSecretAnchors {
  private static final String ID = "id";
  private static final String TYPE = "type";
  private static final String CONFIG = "config";
  private static final String SUBSCRIPTION = "subscription";
  private static final List<String> HOLDER_KINDS = List.of(Entity.USER, Entity.TEAM);

  @Override
  public void anchorsIn(JsonDocument document, Consumer<Anchor> sink) {
    document
        .objectNodes()
        .forEach(
            node -> {
              destinationAnchor(node).ifPresent(sink);
              profileAnchors(node, document.enclosingId(), sink);
            });
  }

  private static Optional<Anchor> destinationAnchor(JsonNode node) {
    return looksLikeADestination(node)
        ? asDestination(node)
            .map(destination -> anchorOf(destination, node.path(CONFIG)))
            .filter(anchor -> !anchor.fields().isEmpty())
        : Optional.empty();
  }

  private static boolean looksLikeADestination(JsonNode node) {
    return uuidOf(node.path(ID)).isPresent()
        && node.path(TYPE).isTextual()
        && node.path(CONFIG).isObject();
  }

  private static Optional<SubscriptionDestination> asDestination(JsonNode node) {
    try {
      return Optional.of(JsonUtils.treeToValue(node, SubscriptionDestination.class));
    } catch (JsonParsingException e) {
      LOG.debug("An object with an id, a type and a config is not a destination");
      return Optional.empty();
    }
  }

  private static Anchor anchorOf(SubscriptionDestination destination, JsonNode config) {
    return new Anchor(
        config,
        DestinationSecrets.ownerOf(destination),
        DestinationSecrets.secretFieldsOf(destination, config));
  }

  private static void profileAnchors(
      JsonNode node, Optional<UUID> holderId, Consumer<Anchor> sink) {
    JsonNode subscription = node.path(SUBSCRIPTION);
    if (subscription.isObject() && holderId.isPresent()) {
      subscription
          .properties()
          .forEach(
              slot -> {
                if (slot.getValue().isObject()) {
                  anchorSlot(slot.getKey(), slot.getValue(), holderId.get(), sink);
                }
              });
    }
  }

  private static void anchorSlot(
      String slot, JsonNode config, UUID holderId, Consumer<Anchor> sink) {
    List<JsonPointer> fields = WebhookSecrets.fieldsIn(config);
    if (!fields.isEmpty()) {
      for (String entityType : HOLDER_KINDS) {
        sink.accept(
            new Anchor(
                config,
                new ProfileWebhookSecrets.Holder(entityType, holderId).ownerOf(slot),
                fields));
      }
    }
  }

  private static Optional<UUID> uuidOf(JsonNode node) {
    Optional<UUID> id = Optional.empty();
    if (node.isTextual()) {
      try {
        id = Optional.of(UUID.fromString(node.textValue()));
      } catch (IllegalArgumentException e) {
        LOG.trace("An id that is not a UUID names no destination");
      }
    }
    return id;
  }
}
