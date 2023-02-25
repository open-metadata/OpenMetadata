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

import org.openmetadata.schema.monitoring.EventMonitorProvider;

public class EventMonitorFactory {

  public static EventMonitor createEventMonitor(EventMonitorConfiguration config, String clusterName) {

    EventMonitorProvider eventMonitorProvider = config != null ? config.getEventMonitor() : null;

    if (eventMonitorProvider == EventMonitorProvider.CLOUDWATCH) {
      return new CloudwatchEventMonitor(eventMonitorProvider, config, clusterName);
    } else if (eventMonitorProvider == EventMonitorProvider.PROMETHEUS) {
      return new PrometheusEventMonitor(eventMonitorProvider, config, clusterName);
    }

    throw new IllegalArgumentException("Not implemented Event monitor: " + eventMonitorProvider);
  }
}
