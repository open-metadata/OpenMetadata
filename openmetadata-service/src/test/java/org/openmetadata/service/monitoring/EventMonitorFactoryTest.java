/*
 *  Copyright 2022 Collate
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
package org.openmetadata.service.monitoring;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.monitoring.EventMonitorProvider;

public class EventMonitorFactoryTest {

  private EventMonitorConfiguration config;

  private static final String CLUSTER_NAME = "openmetadata";

  @BeforeEach
  void setUp() {
    config = new EventMonitorConfiguration();
    config.setParameters(new HashMap<>());
  }

  @Test
  void testIsCreatedItCloudwatchEventMonitor() {
    config.setEventMonitor(EventMonitorProvider.CLOUDWATCH);
    assertTrue(EventMonitorFactory.createEventMonitor(config, CLUSTER_NAME) instanceof CloudwatchEventMonitor);
  }
}
