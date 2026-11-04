/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.resources.events.subscription;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.Optional;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.alerting.channel.DestinationSecretGuards;
import org.openmetadata.service.alerting.channel.DestinationSecrets;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository.StoredDestination;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/**
 * The destinations a test send resolves before anything judges or sends them. A destination sent
 * back as it was read carries masks for its secrets: it is tested with the secrets stored for it,
 * by a caller allowed to edit the alert that holds them, and only as stored — one whose
 * credentials changed is tested once every one of them is entered.
 */
public final class DestinationTestSecrets {
  private final EventSubscriptionRepository subscriptions;
  private final Authorizer authorizer;

  public DestinationTestSecrets(EventSubscriptionRepository subscriptions, Authorizer authorizer) {
    this.subscriptions = subscriptions;
    this.authorizer = authorizer;
  }

  public void resolve(SecurityContext securityContext, SubscriptionDestination destination) {
    if (DestinationSecrets.hasMaskedSecrets(destination)) {
      resolveStored(securityContext, destination);
    } else {
      DestinationSecretGuards.requireNoCiphertext(List.of(destination));
    }
  }

  private void resolveStored(SecurityContext securityContext, SubscriptionDestination destination) {
    StoredDestination stored = storedDestination(destination);
    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.EVENT_SUBSCRIPTION, MetadataOperation.EDIT_ALL),
        new ResourceContext<>(Entity.EVENT_SUBSCRIPTION, stored.alertId(), null));
    DestinationSecrets.restore(stored.destination(), destination);
    DestinationSecretGuards.requireSecretsAsStored(stored.destination(), destination);
  }

  private StoredDestination storedDestination(SubscriptionDestination destination) {
    return Optional.ofNullable(destination.getId())
        .flatMap(subscriptions::findDestination)
        .orElseThrow(
            () ->
                new BadRequestException(
                    "A destination with masked values is tested as stored; provide the actual"
                        + " values"));
  }
}
