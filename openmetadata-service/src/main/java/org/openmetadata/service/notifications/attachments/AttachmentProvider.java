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

package org.openmetadata.service.notifications.attachments;

import java.util.Optional;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.ChangeEvent;

/**
 * Produces the file an alert carries for events about one type of entity. It is found on the
 * classpath through the service loader and asked once per event and alert. It answers only for
 * the event it exists for, such as the outcome of a refresh, and with nothing for any other
 * event about the same entity, so an ordinary edit never carries a report.
 */
public interface AttachmentProvider {
  /** The entity type of the events it may answer for. */
  String sourceType();

  Optional<Attachment> attachmentFor(ChangeEvent event, EventSubscription alert);
}
