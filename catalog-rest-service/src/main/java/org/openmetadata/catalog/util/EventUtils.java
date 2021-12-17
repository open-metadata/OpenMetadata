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

package org.openmetadata.catalog.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class EventUtils {

  private static final Logger LOG = LoggerFactory.getLogger(EventUtils.class);

  private EventUtils() {}

  public static void publishEntityCreatedEvent(String entity, String entityName, String event) {
    String print = String.format("Entity Created: [%s] Name: [%s] Event: [%s]", entity, entityName, event);
    LOG.info(print);
  }

  public static void publishEntityUpdatedEvent(String entity, String entityName, String oldEvent, String newEvent) {
    String diff = JsonUtils.diffTwoJson(oldEvent, newEvent);
    String print = String.format("Entity Updated: [%s] Name: [%s] DiffString: [%s]", entity, entityName, diff);
    LOG.info(print);
  }
}
