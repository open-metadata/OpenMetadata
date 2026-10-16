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

package org.openmetadata.service.alerting.content;

import java.util.UUID;
import org.openmetadata.schema.entity.events.NotificationTemplate;

/** Where the message engine reads the templates it renders, including deleted ones. */
public interface TemplateLookup {

  /** The template of this name, or null when there is none. */
  NotificationTemplate byName(String name);

  /** The template of this id; throws when there is none. */
  NotificationTemplate byId(UUID id);
}
