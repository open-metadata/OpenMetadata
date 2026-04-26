/*
 *  Copyright 2025 Collate
 *  Licensed under the Collate Community License, Version 1.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.mcp.tools;

import static org.openmetadata.schema.type.MetadataOperation.CREATE;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType;
import org.openmetadata.schema.entity.events.TriggerConfig;
import org.openmetadata.schema.entity.events.TriggerConfig.TriggerType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.events.subscription.EventSubscriptionMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.RestUtil;

/**
 * MCP tool that creates an OpenMetadata EventSubscription (alert). v1 supports a single, opinionated
 * shape: webhook destination + ingestion-pipeline failure trigger. Multi-destination + multi-event
 * variants are deferred to follow-up PRs (see issue #26609).
 */
@Slf4j
public class CreateAlertTool implements McpTool {

  private static final String SUPPORTED_RESOURCE_TYPE = "ingestionPipeline";
  private static final String SUPPORTED_EVENT_TYPE = "pipelineFailed";

  private static final EventSubscriptionMapper MAPPER = new EventSubscriptionMapper();

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params) {
    throw new UnsupportedOperationException("CreateAlertTool requires limit validation.");
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    String alertName = requireString(params, "alertName");
    if (alertName == null) {
      return errorMap("alertName is required");
    }

    String resourceType = requireString(params, "resourceType");
    if (!SUPPORTED_RESOURCE_TYPE.equals(resourceType)) {
      return errorMap("v1 supports resourceType=" + SUPPORTED_RESOURCE_TYPE + " only");
    }

    String resourceFqn = requireString(params, "resourceFqn");
    if (resourceFqn == null) {
      return errorMap("resourceFqn is required");
    }

    String eventType = requireString(params, "eventType");
    if (!SUPPORTED_EVENT_TYPE.equals(eventType)) {
      return errorMap("v1 supports eventType=" + SUPPORTED_EVENT_TYPE + " only");
    }

    String webhookUrl = requireString(params, "webhookUrl");
    if (webhookUrl == null || !isValidHttpUrl(webhookUrl)) {
      return errorMap("webhookUrl must be a valid http(s) URL");
    }

    String description = optionalString(params, "description");

    OperationContext operationContext = new OperationContext(Entity.EVENT_SUBSCRIPTION, CREATE);
    String userName = securityContext.getUserPrincipal().getName();

    CreateEventSubscription create = buildRequest(alertName, description, webhookUrl);
    EventSubscription entity = MAPPER.createToEntity(create, userName);

    CreateResourceContext<EventSubscription> createResourceContext =
        new CreateResourceContext<>(Entity.EVENT_SUBSCRIPTION, entity);
    limits.enforceLimits(securityContext, createResourceContext, operationContext);
    authorizer.authorize(securityContext, operationContext, createResourceContext);

    EventSubscriptionRepository repo =
        (EventSubscriptionRepository) Entity.getEntityRepository(Entity.EVENT_SUBSCRIPTION);
    repo.prepareInternal(entity, false);

    String impersonatedBy = ImpersonationContext.getImpersonatedBy();
    RestUtil.PutResponse<EventSubscription> response =
        repo.createOrUpdate(null, entity, userName, impersonatedBy);

    Map<String, Object> result = new HashMap<>();
    EventSubscription created = response.getEntity();
    result.put("alertId", created.getId() != null ? created.getId().toString() : null);
    result.put("alertName", created.getName());
    result.put("resourceFqn", resourceFqn);
    result.put("eventType", eventType);
    result.put("webhookUrl", webhookUrl);
    result.put("enabled", Boolean.TRUE.equals(created.getEnabled()));
    result.put("createdAt", created.getUpdatedAt());
    return result;
  }

  private static CreateEventSubscription buildRequest(
      String name, String description, String webhookUrl) {
    CreateEventSubscription r = new CreateEventSubscription();
    r.setName(name);
    if (description != null) {
      r.setDescription(description);
    }
    r.setAlertType(AlertType.NOTIFICATION);
    r.setResources(List.of(SUPPORTED_RESOURCE_TYPE));
    r.setEnabled(true);
    r.setBatchSize(10);
    r.setRetries(3);
    r.setPollInterval(10);

    TriggerConfig trigger = new TriggerConfig();
    trigger.setTriggerType(TriggerType.REAL_TIME);
    r.setTrigger(trigger);

    SubscriptionDestination dest = new SubscriptionDestination();
    dest.setId(UUID.randomUUID());
    dest.setCategory(SubscriptionCategory.EXTERNAL);
    dest.setType(SubscriptionType.WEBHOOK);
    // secretKey must be null (not "") so the mapper's Fernet encryption step
    // skips it. Encrypting an empty string would silently break later webhook
    // signature verification.
    Map<String, Object> config = new HashMap<>();
    config.put("endpoint", webhookUrl);
    config.put("secretKey", null);
    config.put("headers", new HashMap<>());
    dest.setConfig(JsonUtils.convertValue(config, Object.class));

    r.setDestinations(List.of(dest));
    return r;
  }

  private static boolean isValidHttpUrl(String s) {
    return s != null && (s.startsWith("http://") || s.startsWith("https://"));
  }

  private static String requireString(Map<String, Object> params, String key) {
    Object v = params.get(key);
    return (v == null || v.toString().isBlank()) ? null : v.toString().trim();
  }

  private static String optionalString(Map<String, Object> params, String key) {
    Object v = params.get(key);
    return (v == null || v.toString().isBlank()) ? null : v.toString();
  }

  private static Map<String, Object> errorMap(String msg) {
    Map<String, Object> m = new HashMap<>();
    m.put("error", msg);
    return m;
  }
}
