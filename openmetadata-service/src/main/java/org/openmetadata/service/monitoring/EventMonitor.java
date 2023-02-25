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

import lombok.Getter;
import org.openmetadata.schema.monitoring.EventMonitorProvider;
import org.openmetadata.schema.type.ChangeEvent;

public abstract class EventMonitor {

  @Getter private final String clusterPrefix;

  @Getter private final EventMonitorProvider eventMonitoringProvider;
  @Getter private final EventMonitorConfiguration eventMonitorConfiguration;

  protected EventMonitor(
      EventMonitorProvider eventMonitorProvider, EventMonitorConfiguration config, String clusterPrefix) {
    this.eventMonitoringProvider = eventMonitorProvider;
    this.clusterPrefix = clusterPrefix;
    this.eventMonitorConfiguration = config;
  }

  protected String buildMetricNamespace(String namespace) {
    return String.format("%s/%s", this.clusterPrefix, namespace);
  }

  protected abstract void pushMetric(ChangeEvent event);

  protected abstract void close();
}
