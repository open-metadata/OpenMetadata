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

package org.openmetadata.service.services.analytics;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.io.IOException;
import java.util.List;
import java.util.regex.Pattern;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.analytics.CustomEvent;
import org.openmetadata.schema.analytics.PageViewData;
import org.openmetadata.schema.analytics.WebAnalyticEvent;
import org.openmetadata.schema.analytics.WebAnalyticEventData;
import org.openmetadata.schema.analytics.type.WebAnalyticEventType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.WebAnalyticEventRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.analytics.WebAnalyticEventMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.Service;

/**
 * Service layer for WebAnalyticEvent entity operations.
 *
 * <p>Extends EntityBaseService to inherit all standard CRUD operations with proper authorization
 * and repository delegation.
 */
@Slf4j
@Singleton
@Service(entityType = Entity.WEB_ANALYTIC_EVENT)
public class WebAnalyticEventService
    extends EntityBaseService<WebAnalyticEvent, WebAnalyticEventRepository> {

  @Getter private final WebAnalyticEventMapper mapper;
  public static final String FIELDS = "owners";
  private static final Pattern HTML_PATTERN = Pattern.compile(".*\\<[^>]+>.*", Pattern.DOTALL);

  @Inject
  public WebAnalyticEventService(
      WebAnalyticEventRepository repository,
      Authorizer authorizer,
      WebAnalyticEventMapper mapper,
      Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.WEB_ANALYTIC_EVENT, WebAnalyticEvent.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    List<WebAnalyticEvent> webAnalyticEvents =
        repository.getEntitiesFromSeedData(".*json/data/analytics/webAnalyticEvents/.*\\.json$");
    for (WebAnalyticEvent webAnalyticEvent : webAnalyticEvents) {
      repository.initializeEntity(webAnalyticEvent);
    }
  }

  public Response addWebAnalyticEventData(WebAnalyticEventData webAnalyticEventData) {
    return repository.addWebAnalyticEventData(sanitizeWebAnalyticEventData(webAnalyticEventData));
  }

  public void deleteWebAnalyticEventData(
      SecurityContext securityContext, WebAnalyticEventType name, Long timestamp) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.DELETE);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name.value()));
    repository.deleteWebAnalyticEventData(name, timestamp);
  }

  public ResultList<WebAnalyticEventData> getWebAnalyticEventData(
      String eventType, Long startTs, Long endTs) {
    return repository.getWebAnalyticEventData(eventType, startTs, endTs);
  }

  public static WebAnalyticEventData sanitizeWebAnalyticEventData(
      WebAnalyticEventData webAnalyticEventDataInput) {
    Object inputData = webAnalyticEventDataInput.getEventData();
    if (webAnalyticEventDataInput.getEventType().equals(WebAnalyticEventType.PAGE_VIEW)) {
      PageViewData pageViewData = JsonUtils.convertValue(inputData, PageViewData.class);
      webAnalyticEventDataInput.setEventData(pageViewData);
    } else if (webAnalyticEventDataInput.getEventType().equals(WebAnalyticEventType.CUSTOM_EVENT)) {
      CustomEvent customEventData = JsonUtils.convertValue(inputData, CustomEvent.class);
      if (customEventData.getEventType().equals(CustomEvent.CustomEventTypes.CLICK)) {
        if (containsHtml(customEventData.getEventValue())) {
          throw new IllegalArgumentException("Invalid event value for custom event.");
        }
        webAnalyticEventDataInput.setEventData(customEventData);
      } else {
        throw new IllegalArgumentException("Invalid event type for custom event");
      }
    } else {
      throw new IllegalArgumentException("Invalid event type for Web Analytic Event Data");
    }

    return webAnalyticEventDataInput;
  }

  public static boolean containsHtml(String input) {
    if (input == null || input.isEmpty()) {
      return false;
    }
    return HTML_PATTERN.matcher(input).matches();
  }

  public static class WebAnalyticEventList extends ResultList<WebAnalyticEvent> {
    /* Required for serde */
  }

  public static class WebAnalyticEventDataList extends ResultList<WebAnalyticEventData> {
    /* Required for serde */
  }
}
