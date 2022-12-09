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

import io.micrometer.core.instrument.Counter;
import io.micrometer.prometheus.PrometheusMeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.monitoring.EventMonitorProvider;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.util.MicrometerBundleSingleton;
import software.amazon.awssdk.services.cloudwatch.model.CloudWatchException;

@Slf4j
public class PrometheusEventMonitor extends EventMonitor {

  private final PrometheusMeterRegistry meterRegistry;
  private static final String PIPELINE_STATUS = "pipelineStatus";
  private static final String COUNTER_NAME = "ingestionPipeline.counter";
  private static final String FQN_TAG_NAME = "fqn";
  private static final String PIPELINE_TYPE_TAG_NAME = "pipelineType";
  private static final String EVENT_TYPE_TAG_NAME = "eventType";
  private static final String CLUSTER_TAG_NAME = "clusterName";

  public PrometheusEventMonitor(
      EventMonitorProvider eventMonitorProvider, EventMonitorConfiguration config, String clusterPrefix) {
    super(eventMonitorProvider, config, clusterPrefix);
    meterRegistry = MicrometerBundleSingleton.prometheusMeterRegistry;
  }

  @Override
  protected void pushMetric(ChangeEvent event) {
    String fqn = event.getEntityFullyQualifiedName();
    IngestionPipeline ingestionPipeline = (IngestionPipeline) event.getEntity();
    String pipelineType = ingestionPipeline.getPipelineType().toString();

    try {
      switch (event.getEventType()) {
        case ENTITY_DELETED:
        case ENTITY_SOFT_DELETED:
        case ENTITY_CREATED:
          incrementIngestionPipelineCounter(fqn, pipelineType, event.getEventType().value());
          break;
        case ENTITY_UPDATED:
          // we can have multiple updates bundled together
          event
              .getChangeDescription()
              .getFieldsUpdated()
              .forEach(
                  change -> {
                    if (change.getName().equals(PIPELINE_STATUS) && change.getNewValue() != null) {
                      PipelineStatus pipelineStatus = (PipelineStatus) change.getNewValue();
                      incrementIngestionPipelineCounter(fqn, pipelineType, pipelineStatus.getPipelineState().value());
                    }
                  });

        default:
          throw new IllegalArgumentException("Invalid EventType " + event.getEventType());
      }
    } catch (IllegalArgumentException | CloudWatchException e) {
      LOG.error("Failed to publish IngestionPipeline Cloudwatch metric due to " + e.getMessage());
    }
  }

  @Override
  protected void close() {
    meterRegistry.close();
  }

  /**
   * A new counter will be created only if it does not exist for the given set of tags. Otherwise, micrometer will
   * increase the count of the existing counter. Ref <a
   * href="https://stackoverflow.com/questions/59592118/dynamic-tag-values-for-the-counter-metric-in-micrometer">...</a>
   *
   * @param fqn Pipeline FQN
   * @param pipelineType Metadata, Profiler,...
   * @param eventType running, failed, entityCreated,...
   */
  public void incrementIngestionPipelineCounter(String fqn, String pipelineType, String eventType) {
    Counter.builder(COUNTER_NAME)
        .tags(
            FQN_TAG_NAME,
            fqn,
            PIPELINE_TYPE_TAG_NAME,
            pipelineType,
            EVENT_TYPE_TAG_NAME,
            eventType,
            CLUSTER_TAG_NAME,
            getClusterPrefix())
        .register(meterRegistry)
        .increment();
  }
}
