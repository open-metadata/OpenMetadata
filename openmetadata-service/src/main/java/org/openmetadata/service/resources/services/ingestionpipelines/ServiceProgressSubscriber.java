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

package org.openmetadata.service.resources.services.ingestionpipelines;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.ws.rs.core.SecurityContext;
import java.util.Optional;
import java.util.function.Function;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.ServiceProgressEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.security.ActivePersonaContext;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/** Applies a caller's pipeline permissions and response masking to a service progress stream. */
final class ServiceProgressSubscriber
    implements Function<ServiceProgressEvent, Optional<ServiceProgressEvent>> {
  private final Authorizer authorizer;
  private final SecurityContext securityContext;
  private final OpenMetadataApplicationConfig config;
  private final EntityReference service;
  private final String impersonatedBy;
  private final String activePersona;
  // Decisions belong to this connection; cap both allowed and denied pipeline entries.
  private final Cache<String, Boolean> pipelineAccess =
      Caffeine.newBuilder().maximumSize(512).build();

  ServiceProgressSubscriber(
      Authorizer authorizer,
      SecurityContext securityContext,
      OpenMetadataApplicationConfig config,
      EntityReference service) {
    this.authorizer = authorizer;
    this.securityContext = securityContext;
    this.config = config;
    this.service = service;
    this.impersonatedBy = ImpersonationContext.getImpersonatedBy();
    this.activePersona = ActivePersonaContext.getActivePersona();
  }

  @Override
  public Optional<ServiceProgressEvent> apply(ServiceProgressEvent event) {
    // Live callbacks run on a reporting PUT's thread, but policy conditions belong to the viewer.
    String producer = ImpersonationContext.getImpersonatedBy();
    String producerPersona = ActivePersonaContext.getActivePersona();
    ImpersonationContext.setImpersonatedBy(impersonatedBy);
    ActivePersonaContext.setActivePersona(activePersona);
    try {
      return visibleEvent(event);
    } finally {
      ImpersonationContext.setImpersonatedBy(producer);
      ActivePersonaContext.setActivePersona(producerPersona);
    }
  }

  private Optional<ServiceProgressEvent> visibleEvent(ServiceProgressEvent event) {
    if (!pipelineAccess.get(event.getPipelineFqn(), this::canViewPipeline)) {
      return Optional.empty();
    }
    if (event.getIngestionPipeline() == null) {
      return Optional.of(event);
    }
    IngestionPipeline pipeline =
        JsonUtils.deepCopy(event.getIngestionPipeline(), IngestionPipeline.class);
    IngestionPipelineSecrets.decryptOrNullify(authorizer, securityContext, config, pipeline, false);
    return Optional.of(
        new ServiceProgressEvent()
            .withPipelineFqn(event.getPipelineFqn())
            .withRunId(event.getRunId())
            .withEvent(event.getEvent())
            .withIngestionPipeline(pipeline));
  }

  private boolean canViewPipeline(String pipelineFqn) {
    try {
      ResourceContext<IngestionPipeline> context =
          new ResourceContext<>(Entity.INGESTION_PIPELINE, null, pipelineFqn, Include.NON_DELETED);
      authorizer.authorize(
          securityContext,
          new OperationContext(Entity.INGESTION_PIPELINE, MetadataOperation.VIEW_BASIC),
          context);
      authorizer.authorize(
          securityContext,
          new OperationContext(Entity.INGESTION_PIPELINE, MetadataOperation.VIEW_ALL),
          context);
      IngestionPipeline pipeline = (IngestionPipeline) context.getEntity();
      EntityReference parent = pipeline == null ? null : pipeline.getService();
      return parent != null
          && service.getType().equals(parent.getType())
          && service.getId().equals(parent.getId());
    } catch (AuthorizationException | EntityNotFoundException e) {
      return false;
    }
  }
}
