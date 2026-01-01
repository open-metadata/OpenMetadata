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

package org.openmetadata.service.services.bots;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.io.IOException;
import java.util.List;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.BotRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.bots.BotMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.UserUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.BOT)
public class BotService extends AbstractEntityService<Bot> {

  @Getter private final BotMapper mapper;
  private final BotRepository botRepository;

  @Inject
  public BotService(
      BotRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      BotMapper mapper) {
    super(repository, searchRepository, authorizer, Entity.BOT);
    this.botRepository = repository;
    this.mapper = mapper;
  }

  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    String domain = SecurityUtil.getDomain(config);

    // First, load the bot users and assign their roles
    UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    List<User> botUsers = userRepository.getEntitiesFromSeedData(".*json/data/botUser/.*\\.json$");
    for (User botUser : botUsers) {
      User user =
          UserUtil.user(botUser.getName(), domain, botUser.getName())
              .withIsBot(true)
              .withIsAdmin(false);
      user.setRoles(
          listOrEmpty(botUser.getRoles()).stream()
              .map(
                  entityReference -> {
                    Role role =
                        Entity.getEntityByName(
                            Entity.ROLE,
                            entityReference.getName(),
                            "id",
                            Include.NON_DELETED,
                            true);
                    return role.getEntityReference();
                  })
              .toList());
      // Add or update User Bot
      UserUtil.addOrUpdateBotUser(user);
    }

    // Then, load the bots and bind them to the users
    List<Bot> bots = botRepository.getEntitiesFromSeedData();
    for (Bot bot : bots) {
      String userName = bot.getBotUser().getName();
      bot.withBotUser(
          userRepository
              .getByName(null, userName, userRepository.getFields("id"))
              .getEntityReference());
      botRepository.initializeEntity(bot);
    }
  }
}
