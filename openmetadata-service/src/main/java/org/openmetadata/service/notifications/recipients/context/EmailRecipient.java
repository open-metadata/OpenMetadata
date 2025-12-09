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

package org.openmetadata.service.notifications.recipients.context;

import java.util.Objects;
import lombok.Getter;
import lombok.ToString;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;

/**
 * Email recipient with a single email address.
 *
 * Represents a recipient that should receive notifications via email. Two EmailRecipient instances
 * are equal if they have the same email address.
 */
@Getter
@ToString
public final class EmailRecipient extends Recipient {
  private final String email;

  public EmailRecipient(String email) {
    this.email = Objects.requireNonNull(email, "email cannot be null");
  }

  /**
   * Create an email recipient from a user.
   *
   * @param user the user to create a recipient from
   * @return an EmailRecipient instance
   */
  public static EmailRecipient fromUser(User user) {
    return new EmailRecipient(user.getEmail());
  }

  /**
   * Create an email recipient from a team.
   *
   * @param team the team to create a recipient from
   * @return an EmailRecipient instance
   */
  public static EmailRecipient fromTeam(Team team) {
    return new EmailRecipient(team.getEmail());
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (!(o instanceof EmailRecipient that)) {
      return false;
    }
    return Objects.equals(email, that.email);
  }

  @Override
  public int hashCode() {
    return Objects.hash(email);
  }
}
