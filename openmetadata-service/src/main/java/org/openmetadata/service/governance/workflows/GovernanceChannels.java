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

package org.openmetadata.service.governance.workflows;

import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.GOVERNANCE_WORKFLOW_CHANGE_EVENT;

import java.util.List;
import org.openmetadata.service.alerting.audience.AddressDirectory;
import org.openmetadata.service.alerting.channel.Channel;
import org.openmetadata.service.alerting.channel.ChannelProvider;
import org.openmetadata.service.alerting.channel.ComposedChannel;
import org.openmetadata.service.alerting.channel.ConfigRules;

/** The channel governance workflows read change events through; it delivers inside the server. */
public final class GovernanceChannels implements ChannelProvider {
  @Override
  public List<Channel> channels() {
    return List.of(
        new ComposedChannel(
            GOVERNANCE_WORKFLOW_CHANGE_EVENT.value(),
            null,
            null,
            AddressDirectory.NONE,
            ConfigRules.NONE,
            (alert, destination, renderer) -> new WorkflowEventConsumer(alert, destination)));
  }
}
