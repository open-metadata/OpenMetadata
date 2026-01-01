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

package org.openmetadata.service.services.events;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.events.scheduled.EventSubscriptionScheduler;
import org.openmetadata.service.events.subscription.EventsSubscriptionRegistry;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;
import org.openmetadata.service.resources.events.subscription.EventSubscriptionMapper;
import org.openmetadata.service.resources.events.subscription.EventSubscriptionResource;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;

/**
 * Service layer for EventSubscription entity operations.
 *
 * <p>Extends AbstractEntityService to inherit all standard CRUD operations with proper
 * authorization and repository delegation.
 */
@Slf4j
@Singleton
@Service(entityType = Entity.EVENT_SUBSCRIPTION)
public class EventSubscriptionService extends AbstractEntityService<EventSubscription> {

  @Getter private final EventSubscriptionMapper mapper;
  private final EventSubscriptionRepository eventSubscriptionRepository;

  @Inject
  public EventSubscriptionService(
      EventSubscriptionRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      EventSubscriptionMapper mapper) {
    super(repository, searchRepository, authorizer, Entity.EVENT_SUBSCRIPTION);
    this.eventSubscriptionRepository = repository;
    this.mapper = mapper;
  }

  public void initialize(OpenMetadataApplicationConfig config) {
    EventSubscriptionScheduler.initialize(config);
    EventsSubscriptionRegistry.initialize(
        listOrEmpty(EventSubscriptionResource.getNotificationsFilterDescriptors()),
        listOrEmpty(EventSubscriptionResource.getObservabilityFilterDescriptors()));
    eventSubscriptionRepository.initSeedDataFromResources();
    initializeEventSubscriptions();
  }

  private void initializeEventSubscriptions() {
    CollectionDAO daoCollection = eventSubscriptionRepository.getDaoCollection();
    daoCollection.eventSubscriptionDAO().listAllEventsSubscriptions().stream()
        .map(obj -> JsonUtils.readValue(obj, EventSubscription.class))
        .forEach(
            subscription -> {
              try {
                EventSubscriptionScheduler.getInstance()
                    .addSubscriptionPublisher(subscription, true);
              } catch (Exception ex) {
                LOG.error("Failed to initialize subscription: {}", subscription.getId(), ex);
              }
            });
  }
}
