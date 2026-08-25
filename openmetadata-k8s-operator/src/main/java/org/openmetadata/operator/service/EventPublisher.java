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

package org.openmetadata.operator.service;

import io.fabric8.kubernetes.api.model.Event;
import io.fabric8.kubernetes.api.model.EventBuilder;
import io.fabric8.kubernetes.api.model.EventSource;
import io.fabric8.kubernetes.api.model.EventSourceBuilder;
import io.fabric8.kubernetes.api.model.ObjectReference;
import io.fabric8.kubernetes.api.model.ObjectReferenceBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import java.time.Instant;
import org.openmetadata.operator.model.OMJobResource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Service for publishing Kubernetes events related to OMJob lifecycle.
 *
 * Events provide visibility into operator actions and help with debugging
 * and monitoring of OMJob executions.
 */
public class EventPublisher {

  private static final Logger LOG = LoggerFactory.getLogger(EventPublisher.class);

  private static final String EVENT_SOURCE_COMPONENT = "omjob-operator";
  private static final String EVENT_TYPE_NORMAL = "Normal";
  private static final String EVENT_TYPE_WARNING = "Warning";

  private final KubernetesClient client;
  private final EventSource eventSource;

  public EventPublisher(KubernetesClient client) {
    this.client = client;
    this.eventSource = new EventSourceBuilder().withComponent(EVENT_SOURCE_COMPONENT).build();
  }

  /**
   * Publish a normal (informational) event
   */
  public void publishNormalEvent(OMJobResource omJob, String reason, String message) {
    publishEvent(omJob, EVENT_TYPE_NORMAL, reason, message);
  }

  /**
   * Publish a warning event
   */
  public void publishWarningEvent(OMJobResource omJob, String reason, String message) {
    publishEvent(omJob, EVENT_TYPE_WARNING, reason, message);
  }

  /**
   * Publish a Kubernetes event
   */
  private void publishEvent(OMJobResource omJob, String type, String reason, String message) {
    try {
      String eventName = generateEventName(omJob, reason);
      String namespace = omJob.getMetadata().getNamespace();

      ObjectReference involvedObject =
          new ObjectReferenceBuilder()
              .withApiVersion(omJob.getApiVersion())
              .withKind(omJob.getKind())
              .withName(omJob.getMetadata().getName())
              .withNamespace(namespace)
              .withUid(omJob.getMetadata().getUid())
              .build();

      Event event =
          new EventBuilder()
              .withNewMetadata()
              .withName(eventName)
              .withNamespace(namespace)
              .withLabels(omJob.getMetadata().getLabels())
              .endMetadata()
              .withInvolvedObject(involvedObject)
              .withType(type)
              .withReason(reason)
              .withMessage(message)
              .withSource(eventSource)
              .withFirstTimestamp(Instant.now().toString())
              .withLastTimestamp(Instant.now().toString())
              .withCount(1)
              .build();

      // Try to create the event
      client.v1().events().inNamespace(namespace).resource(event).create();

      LOG.debug(
          "Published {} event for OMJob {}: {} - {}",
          type,
          omJob.getMetadata().getName(),
          reason,
          message);

    } catch (Exception e) {
      // Event publishing should not fail the reconciliation
      LOG.warn(
          "Failed to publish event for OMJob {}: {} - {}",
          omJob.getMetadata().getName(),
          reason,
          message,
          e);
    }
  }

  /**
   * Generate a unique event name
   */
  private String generateEventName(OMJobResource omJob, String reason) {
    // Use OMJob name + reason + timestamp to create unique event name
    long timestamp = System.currentTimeMillis() / 1000;
    return String.format(
        "%s.%s.%x", omJob.getMetadata().getName(), reason.toLowerCase(), timestamp);
  }
}
