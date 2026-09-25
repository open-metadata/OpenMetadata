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

import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.notifications.attachments.Attachment;
import org.openmetadata.service.notifications.attachments.AttachmentProvider;

/** OpenMetadata ships no provider, so its tests register this one, for a source of their own. */
public final class FixtureAttachmentProvider implements AttachmentProvider {
  public static final String SOURCE_TYPE = "fixtureReport";
  public static final AtomicInteger TIMES_ASKED = new AtomicInteger();

  @Override
  public String sourceType() {
    return SOURCE_TYPE;
  }

  // Only the event a report exists for carries it; an ordinary edit of the same entity does not.
  @Override
  public Optional<Attachment> attachmentFor(ChangeEvent event, EventSubscription alert) {
    TIMES_ASKED.incrementAndGet();
    boolean itsOwnEvent = event.getEventType() == EventType.ENTITY_CREATED;
    return itsOwnEvent
        ? Optional.of(
            new Attachment(
                "report.pdf", "application/pdf", "a report".getBytes(StandardCharsets.UTF_8)))
        : Optional.empty();
  }
}
