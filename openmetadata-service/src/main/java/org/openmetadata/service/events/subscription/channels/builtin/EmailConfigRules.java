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

package org.openmetadata.service.events.subscription.channels.builtin;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.BadRequestException;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.alert.type.EmailAlertConfig;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.events.subscription.channels.ConfigRules;
import org.openmetadata.service.util.email.EmailUtil;

final class EmailConfigRules implements ConfigRules {
  @Override
  public void validate(SubscriptionDestination destination) {
    EmailAlertConfig config = read(destination.getConfig());
    if (nullOrEmpty(config.getReceivers())) {
      throw new BadRequestException(
          "Email destination requires at least one email address in 'receivers'");
    }
    for (String email : config.getReceivers()) {
      if (!EmailUtil.isValidEmail(email)) {
        throw new BadRequestException(String.format("Invalid email format: '%s'", email));
      }
    }
  }

  @Override
  public SubscriptionAction receiversOf(SubscriptionDestination destination) {
    return JsonUtils.convertValue(destination.getConfig(), EmailAlertConfig.class);
  }

  private static EmailAlertConfig read(Object config) {
    try {
      return JsonUtils.convertValue(config, EmailAlertConfig.class);
    } catch (Exception e) {
      throw new BadRequestException("Invalid email configuration: " + e.getMessage());
    }
  }
}
