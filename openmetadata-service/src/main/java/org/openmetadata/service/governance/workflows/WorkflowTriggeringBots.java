/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.governance.workflows;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;

/**
 * The bots a workflow trigger lists in {@code triggeringBots}: a change by one of them starts the
 * workflow as a person's change does. Only a bot an admin created can be listed. System bots, such
 * as ingestion-bot and governance-bot, and the bot an application runs as write in bulk on their
 * own schedule, so they never start a workflow.
 */
public final class WorkflowTriggeringBots {
  private static final String BOT_USER_FIELD = "botUser";
  // AppRepository.createNewAppBot names an application's bot "<application name>Bot".
  private static final String APPLICATION_BOT_SUFFIX = "Bot";

  private WorkflowTriggeringBots() {}

  /**
   * The users the listed bots write as, which is what a change records as its author. A bot deleted
   * since the workflow was saved starts nothing.
   */
  public static Set<String> botUserNames(final List<String> botNames) {
    return listOrEmpty(botNames).stream()
        .map(WorkflowTriggeringBots::findBot)
        .flatMap(Optional::stream)
        .filter(bot -> bot.getBotUser() != null)
        .map(bot -> bot.getBotUser().getName())
        .collect(Collectors.toUnmodifiableSet());
  }

  /** Refuses a listed name that is not a bot an admin created. */
  public static void requireAdminCreatedBots(final String workflowName, final List<String> names) {
    listOrEmpty(names).forEach(name -> requireAdminCreatedBot(workflowName, name));
  }

  private static void requireAdminCreatedBot(final String workflowName, final String botName) {
    final Bot bot =
        findBot(botName)
            .orElseThrow(
                () ->
                    BadRequestException.of(
                        "Workflow '%s': bot '%s' does not exist, so it cannot trigger the workflow"
                            .formatted(workflowName, botName)));
    if (ProviderType.SYSTEM.equals(bot.getProvider())) {
      throw BadRequestException.of(
          "Workflow '%s': '%s' is a system bot. Only a bot an admin created can trigger a workflow"
              .formatted(workflowName, botName));
    }
    if (isApplicationBot(bot)) {
      throw BadRequestException.of(
          "Workflow '%s': '%s' is an application's bot. Only a bot an admin created can trigger a workflow"
              .formatted(workflowName, botName));
    }
  }

  private static Optional<Bot> findBot(final String botName) {
    Optional<Bot> bot;
    try {
      bot =
          Optional.of(
              Entity.getEntityByName(Entity.BOT, botName, BOT_USER_FIELD, Include.NON_DELETED));
    } catch (EntityNotFoundException notFound) {
      bot = Optional.empty();
    }
    return bot;
  }

  // An application's bot is created with provider user, so only the application tells it apart
  // from a bot an admin created: the installed application links to it, and every application
  // names its bot "<application name>Bot". A bot left behind by an uninstalled application keeps
  // its name but loses the link, and installing the application again reuses it.
  private static boolean isApplicationBot(final Bot bot) {
    return isLinkedToApplication(bot) || isNamedForApplication(bot.getName());
  }

  private static boolean isLinkedToApplication(final Bot bot) {
    return !Entity.getEntityRepository(Entity.BOT)
        .findFrom(bot.getId(), Entity.BOT, Relationship.CONTAINS, Entity.APPLICATION, Include.ALL)
        .isEmpty();
  }

  private static boolean isNamedForApplication(final String botName) {
    final String applicationName =
        botName.endsWith(APPLICATION_BOT_SUFFIX)
            ? botName.substring(0, botName.length() - APPLICATION_BOT_SUFFIX.length())
            : null;
    return applicationName != null
        && !applicationName.isEmpty()
        && (Entity.findByNameOrNull(Entity.APP_MARKET_PLACE_DEF, applicationName, Include.ALL)
                != null
            || Entity.findByNameOrNull(Entity.APPLICATION, applicationName, Include.ALL) != null);
  }
}
