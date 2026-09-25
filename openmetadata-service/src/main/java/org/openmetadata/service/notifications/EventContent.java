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

package org.openmetadata.service.notifications;

import java.util.Optional;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.notifications.attachments.Attachment;
import org.openmetadata.service.notifications.attachments.AttachmentProviders;

/**
 * What an alert says about one event: the template that applies, rendered once to Markdown from a
 * private copy of the event. It is made when the first channel that renders asks for it, and every
 * other channel of the alert formats the same text its own way. An alert that only posts the raw
 * event never asks, so it never renders a template.
 */
public final class EventContent {
  /** Markdown, before any channel has formatted it. */
  public record Rendered(String body, String subject) {}

  private final ChangeEvent event;
  private final EventSubscription alert;
  private Rendered rendered;
  private Optional<Attachment> attachment;

  public EventContent(ChangeEvent event, EventSubscription alert) {
    this.event = event;
    this.alert = alert;
  }

  /** False for an event no channel has asked to render, such as one that only went to webhooks. */
  public synchronized boolean isRendered() {
    return rendered != null;
  }

  /**
   * The file this alert carries for this event, produced on the first ask and never again. Empty
   * when no provider exists for the event's source, or when it answers only for another event.
   */
  public synchronized Optional<Attachment> attachment() {
    if (attachment == null) {
      attachment = AttachmentProviders.attachmentFor(event, alert);
    }
    return attachment;
  }

  public synchronized Rendered by(HandlebarsNotificationMessageEngine engine) {
    if (rendered == null) {
      rendered = engine.render(event, alert);
    }
    return rendered;
  }
}
