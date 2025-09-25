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

package org.openmetadata.service.notifications.pipeline;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.notifications.messages.NotificationMessage;

/**
 * Context object that flows through the notification pipeline.
 * Contains all data needed for notification processing.
 */
@Getter
@Setter
@RequiredArgsConstructor
public class NotificationPipelineContext {
  private ChangeEvent event;
  private final NotificationTemplate template;
  private String renderedBody;
  private String renderedSubject;
  private NotificationMessage message;

  public NotificationPipelineContext(ChangeEvent event, NotificationTemplate template) {
    this.event = event;
    this.template = template;
  }
}
