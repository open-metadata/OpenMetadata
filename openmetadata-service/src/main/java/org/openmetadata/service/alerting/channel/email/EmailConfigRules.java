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

package org.openmetadata.service.alerting.channel.email;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.BadRequestException;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.schema.alert.type.EmailAlertConfig;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.service.alerting.channel.ConfigRules;
import org.openmetadata.service.alerting.channel.DestinationConfig;

final class EmailConfigRules implements ConfigRules {
  @Override
  public void validate(SubscriptionDestination destination) {
    if (ConfigRules.configuredByTheUser(destination)) {
      ConfigRules.requireConfiguration(destination);
      validateReceivers(submitted(destination));
    }
  }

  private static void validateReceivers(EmailAlertConfig config) {
    if (nullOrEmpty(config.getReceivers())) {
      throw new BadRequestException(
          "Email destination requires at least one email address in 'receivers'");
    }
    for (String email : config.getReceivers()) {
      if (!isValidEmail(email)) {
        throw new BadRequestException(String.format("Invalid email format: '%s'", email));
      }
    }
  }

  @Override
  public EmailAlertConfig receiversOf(SubscriptionDestination destination) {
    return stored(destination);
  }

  static EmailAlertConfig stored(SubscriptionDestination destination) {
    return DestinationConfig.stored(destination, EmailAlertConfig.class);
  }

  static EmailAlertConfig submitted(SubscriptionDestination destination) {
    return DestinationConfig.submitted(destination, EmailAlertConfig.class, "email");
  }

  // An address the mail server would take, as the email channel has always judged it.
  static boolean isValidEmail(String email) {
    return !StringUtils.isBlank(email) && email.matches("^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$");
  }
}
