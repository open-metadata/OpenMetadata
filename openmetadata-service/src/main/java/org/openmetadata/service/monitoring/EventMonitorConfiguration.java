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

import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import org.openmetadata.schema.monitoring.EventMonitorProvider;

@Getter
@Setter
public class EventMonitorConfiguration {

  private EventMonitorProvider eventMonitor;

  private int batchSize;

  private Map<String, String> parameters;

  private String[] pathPattern;
}
