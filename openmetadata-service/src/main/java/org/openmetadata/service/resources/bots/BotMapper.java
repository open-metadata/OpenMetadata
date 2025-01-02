package org.openmetadata.service.resources.bots;

import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.BotRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.util.EntityUtil;

public class BotMapper implements EntityMapper<Bot, CreateBot> {
  @Override
  public Bot createToEntity(CreateBot create, String user) {
    BotRepository repository = (BotRepository) Entity.getEntityRepository(Entity.BOT);
    Bot bot = getBot(create, user);
    Bot originalBot = retrieveBot(bot.getName());
    User botUser = retrieveUser(bot);
    if (botUser != null && !Boolean.TRUE.equals(botUser.getIsBot())) {
      throw new IllegalArgumentException(
          String.format("User [%s] is not a bot user", botUser.getName()));
    }
    if (userHasRelationshipWithAnyBot(botUser, originalBot)) {
      List<CollectionDAO.EntityRelationshipRecord> userBotRelationship =
          retrieveBotRelationshipsFor(botUser);
      bot =
          repository.get(
              null,
              userBotRelationship.stream().findFirst().orElseThrow().getId(),
              EntityUtil.Fields.EMPTY_FIELDS);
      throw new IllegalArgumentException(
          CatalogExceptionMessage.userAlreadyBot(botUser.getName(), bot.getName()));
    }
    // TODO: review this flow on https://github.com/open-metadata/OpenMetadata/issues/8321
    if (originalBot != null) {
      bot.setProvider(originalBot.getProvider());
    }
    return bot;
  }

  private Bot getBot(CreateBot create, String user) {
    return copy(new Bot(), create, user)
        .withBotUser(getEntityReference(Entity.USER, create.getBotUser()))
        .withProvider(create.getProvider())
        .withFullyQualifiedName(create.getName());
  }

  private boolean userHasRelationshipWithAnyBot(User user, Bot botUser) {
    if (user == null) {
      return false;
    }
    List<CollectionDAO.EntityRelationshipRecord> userBotRelationship =
        retrieveBotRelationshipsFor(user);
    return !userBotRelationship.isEmpty()
        && (botUser == null
            || userBotRelationship.stream()
                .anyMatch(relationship -> !relationship.getId().equals(botUser.getId())));
  }

  private List<CollectionDAO.EntityRelationshipRecord> retrieveBotRelationshipsFor(User user) {
    BotRepository repository = (BotRepository) Entity.getEntityRepository(Entity.BOT);
    return repository.findFromRecords(user.getId(), Entity.USER, Relationship.CONTAINS, Entity.BOT);
  }

  private User retrieveUser(Bot bot) {
    EntityRepository<? extends EntityInterface> userRepository =
        Entity.getEntityRepository(Entity.USER);
    return (User)
        userRepository.findByNameOrNull(
            bot.getBotUser().getFullyQualifiedName(), Include.NON_DELETED);
  }

  private Bot retrieveBot(String botName) {
    BotRepository repository = (BotRepository) Entity.getEntityRepository(Entity.BOT);
    return repository.findByNameOrNull(botName, Include.NON_DELETED);
  }
}
