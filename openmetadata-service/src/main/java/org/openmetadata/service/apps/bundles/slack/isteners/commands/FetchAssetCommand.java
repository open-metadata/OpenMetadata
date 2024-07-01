package org.openmetadata.service.apps.bundles.slack.isteners.commands;

import com.slack.api.bolt.context.builtin.SlashCommandContext;
import com.slack.api.bolt.handler.builtin.SlashCommandHandler;
import com.slack.api.bolt.request.builtin.SlashCommandRequest;
import com.slack.api.bolt.response.Response;
import com.slack.api.methods.SlackApiException;
import com.slack.api.methods.response.chat.ChatPostMessageResponse;
import com.slack.api.model.block.ActionsBlock;
import com.slack.api.model.block.Blocks;
import com.slack.api.model.block.LayoutBlock;
import com.slack.api.model.block.composition.BlockCompositions;
import com.slack.api.model.block.composition.PlainTextObject;
import com.slack.api.model.block.composition.TextObject;
import com.slack.api.model.block.element.ButtonElement;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.formatter.decorators.SlackMessageDecorator;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.EntityUtil;

public class FetchAssetCommand implements SlashCommandHandler {
  SlackMessageDecorator decorator;
  protected EntityRepository<? extends EntityInterface> repository;
  private static final Map<String, String> entityTypeMap = new HashMap<>();

  public FetchAssetCommand(SlackMessageDecorator decorator) {
    this.decorator = decorator;
  }

  static {
    entityTypeMap.put("glossary", Entity.GLOSSARY);
    entityTypeMap.put("tag", Entity.TAG);
    entityTypeMap.put("glossaryterm", Entity.GLOSSARY_TERM);
    entityTypeMap.put("table", Entity.TABLE);
  }

  @Override
  public Response apply(SlashCommandRequest req, SlashCommandContext ctx)
      throws IOException, SlackApiException {

    if (StringUtils.isBlank(req.getPayload().getText())) {
      return ctx.ack("Please provide a search query.");
    }

    String[] parts = req.getPayload().getText().trim().split("\\s+", 2);

    String entityType =
        Optional.ofNullable(parts[0])
            .map(String::trim)
            .map(String::toLowerCase)
            .filter(s -> s.contains("*"))
            .map(s -> s.replace("*", ""))
            .orElse(parts[0].trim().toLowerCase());

    if (!entityTypeMap.containsKey(entityType)) {
      return ctx.ack("Invalid entity type provided.");
    }

    repository = Entity.getEntityRepository(entityTypeMap.get(entityType));

    String query = parts[1].trim().toLowerCase();

    EntityInterface entity;

    try {
      UUID uuid = UUID.fromString(query);
      entity = fetchDataById(uuid);
    } catch (IllegalArgumentException e) {
      entity = fetchDataByFqn(query);
    } catch (EntityNotFoundException e) {
      ctx.logger.error("Entity not found: {}", e.getMessage());
      return ctx.ack(":warning: Entity not found with the provided name.");
    } catch (Exception e) {
      ctx.logger.error("Error fetching entity data", e);
      return ctx.ack(":x: Failed to fetch entity data. Please try again later.");
    }

    ctx.ack();

    // Continue processing with glossary data
    List<LayoutBlock> blocks = createMessage(entity);

    ChatPostMessageResponse response =
        ctx.client()
            .chatPostMessage(r -> r.channel(req.getPayload().getChannelId()).blocks(blocks));

    if (!response.isOk()) {
      return ctx.ack("Failed to send message: " + response.getError());
    }

    return ctx.ack();
  }

  private List<LayoutBlock> createMessage(EntityInterface entity) {
    List<LayoutBlock> blocks = new ArrayList<>();

    // Header
    blocks.add(
        Blocks.header(
            header ->
                header.text(
                    BlockCompositions.plainText(entity.getClass().getSimpleName() + " Details"))));

    // Name and Description
    blocks.add(
        Blocks.section(
            section ->
                section.text(
                    BlockCompositions.markdownText(
                        "*Name:* "
                            + entity.getName()
                            + "\n"
                            + "*Display Name:* "
                            + entity.getDisplayName()
                            + "\n"
                            + "*Description:* "
                            + entity.getDescription()))));

    // Divider
    blocks.add(Blocks.divider());

    // Additional Information
    List<TextObject> fields = new ArrayList<>();
    fields.add(
        BlockCompositions.markdownText(
            "*Fully Qualified Name:* " + entity.getFullyQualifiedName()));
    fields.add(BlockCompositions.markdownText("*Version:* " + entity.getVersion()));
    fields.add(
        BlockCompositions.markdownText(
            "*Updated At:* " + new Date(entity.getUpdatedAt()).toString()));
    fields.add(BlockCompositions.markdownText("*Updated By:* " + entity.getUpdatedBy()));

    // Dynamically add fields based on available properties
    if (entity instanceof Glossary) {
      Glossary glossary = (Glossary) entity;
      fields.add(BlockCompositions.markdownText("*Provider:* " + glossary.getProvider()));
      fields.add(
          BlockCompositions.markdownText(
              "*Mutually Exclusive:* " + glossary.getMutuallyExclusive()));
      fields.add(BlockCompositions.markdownText("*Usage Count:* " + glossary.getUsageCount()));
      fields.add(BlockCompositions.markdownText("*Term Count:* " + glossary.getTermCount()));
    }

    // Owner
    if (entity.getOwner() != null) {
      EntityReference owner = entity.getOwner();
      fields.add(
          BlockCompositions.markdownText(
              "*Owner:* " + owner.getDisplayName() + " (" + owner.getName() + ")"));
    }

    // Reviewers
    if (entity.getReviewers() != null && !entity.getReviewers().isEmpty()) {
      String reviewers =
          entity.getReviewers().stream()
              .map(EntityReference::getDisplayName)
              .collect(Collectors.joining(", "));
      fields.add(BlockCompositions.markdownText("*Reviewers:* " + reviewers));
    }

    // Tags
    if (entity.getTags() != null && !entity.getTags().isEmpty()) {
      String tags =
          entity.getTags().stream().map(TagLabel::getName).collect(Collectors.joining(", "));
      fields.add(BlockCompositions.markdownText("*Tags:* " + tags));
    }

    // Domain
    if (entity.getDomain() != null) {
      EntityReference domain = entity.getDomain();
      fields.add(
          BlockCompositions.markdownText(
              "*Domain:* " + domain.getDisplayName() + " (" + domain.getName() + ")"));
    }

    // Split fields into multiple sections to avoid block limits
    for (int i = 0; i < fields.size(); i += 10) {
      List<TextObject> sublist = fields.subList(i, Math.min(i + 10, fields.size()));
      blocks.add(Blocks.section(section -> section.fields(sublist)));
    }

    // Divider
    blocks.add(Blocks.divider());

    // Context Block
    blocks.add(
        Blocks.context(
            context ->
                context.elements(
                    List.of(
                        BlockCompositions.markdownText(
                            entity.getClass().getSimpleName() + " provided by OpenMetadata")))));

    // Button Block
    //    String entityUrl = buildEntityUrl(entity);
    blocks.add(
        ActionsBlock.builder()
            .elements(
                List.of(
                    ButtonElement.builder()
                        .text(
                            PlainTextObject.builder()
                                .text("Open " + entity.getClass().getSimpleName())
                                .build())
                        .url("https://open-metadata.org/")
                        .build()))
            .build());

    return blocks;
  }

  public EntityInterface fetchDataByFqn(String fqn) {
    return repository.findByName(fqn, Include.NON_DELETED, false);
  }

  public EntityInterface fetchDataById(UUID id) {
    return repository.find(id, Include.NON_DELETED, false);
  }

  public final EntityUtil.Fields getFields(String fields) {
    return repository.getFields(fields);
  }

  private String buildEntityUrl(EntityInterface entityInterface) {
    return decorator.getEntityUrl(Entity.GLOSSARY, entityInterface.getFullyQualifiedName(), "");
  }
}
