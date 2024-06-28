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
import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.formatter.decorators.SlackMessageDecorator;
import org.openmetadata.service.jdbi3.TagRepository;
import org.openmetadata.service.util.EntityUtil;

public class TagSearchCommand implements SlashCommandHandler {
  SlackMessageDecorator decorator;
  protected final TagRepository repository = (TagRepository) Entity.getEntityRepository(Entity.TAG);

  public TagSearchCommand(SlackMessageDecorator slackMessageDecorator) {
    this.decorator = slackMessageDecorator;
  }

  @Override
  public Response apply(SlashCommandRequest req, SlashCommandContext ctx)
      throws IOException, SlackApiException {
    String tagFqn = req.getPayload().getText().trim();
    Tag ternFqn;
    try {
      ternFqn = fetchData(tagFqn);
    } catch (EntityNotFoundException e) {
      ctx.logger.error("Tag not found: {}", e.getMessage());
      return ctx.ack(":warning: Tag not found with the provided name.");
    } catch (Exception e) {
      ctx.logger.error("Error fetching tag data", e);
      return ctx.ack(":x: Failed to fetch tag data. Please try again later.");
    }

    List<LayoutBlock> blocks = createMessage(ternFqn);

    ChatPostMessageResponse response =
        ctx.client()
            .chatPostMessage(r -> r.channel(req.getPayload().getChannelId()).blocks(blocks));

    if (!response.isOk()) {
      return ctx.ack("Failed to send message: " + response.getError());
    }

    return ctx.ack();
  }

  private List<LayoutBlock> createMessage(Tag tag) {
    List<LayoutBlock> blocks = new ArrayList<>();

    // Header
    blocks.add(Blocks.header(header -> header.text(BlockCompositions.plainText("Tag Details"))));

    // Name and Description
    blocks.add(
        Blocks.section(
            section ->
                section.text(
                    BlockCompositions.markdownText(
                        "*Tag Name:* "
                            + tag.getName()
                            + "\n"
                            + "*Display Name:* "
                            + (tag.getDisplayName() != null ? tag.getDisplayName() : "N/A")
                            + "\n"
                            + "*Description:* "
                            + (tag.getDescription() != null ? tag.getDescription() : "N/A")))));

    // Divider
    blocks.add(Blocks.divider());

    // Additional Information
    List<TextObject> fields = new ArrayList<>();
    fields.add(
        BlockCompositions.markdownText("*Fully Qualified Name:* " + tag.getFullyQualifiedName()));
    fields.add(BlockCompositions.markdownText("*Version:* " + tag.getVersion()));
    fields.add(
        BlockCompositions.markdownText("*Updated At:* " + new Date(tag.getUpdatedAt()).toString()));
    fields.add(BlockCompositions.markdownText("*Updated By:* " + tag.getUpdatedBy()));
    fields.add(BlockCompositions.markdownText("*Provider:* " + tag.getProvider()));
    fields.add(
        BlockCompositions.markdownText("*Mutually Exclusive:* " + tag.getMutuallyExclusive()));
    fields.add(BlockCompositions.markdownText("*Usage Count:* " + tag.getUsageCount()));
    fields.add(BlockCompositions.markdownText("*Deprecated:* " + tag.getDeprecated()));

    // Classification
    if (tag.getClassification() != null) {
      EntityReference classification = tag.getClassification();
      fields.add(
          BlockCompositions.markdownText(
              "*Classification:* "
                  + classification.getDisplayName()
                  + " ("
                  + classification.getName()
                  + ")"));
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
                    List.of(BlockCompositions.markdownText("Tag provided by OpenMetadata")))));

    // Button Block
    String entityUrl = buildEntityUrl(tag); // issue in building entityUrl.
    blocks.add(
        ActionsBlock.builder()
            .elements(
                List.of(
                    ButtonElement.builder()
                        .text(PlainTextObject.builder().text("Open Tag").build())
                        .url("https://open-metadata.org/")
                        .build()))
            .build());

    return blocks;
  }

  public Tag fetchData(String fqn) {
    EntityUtil.Fields fields = getFields("children,usageCount");
    return repository.getByName(null, fqn, fields, Include.NON_DELETED, false);
  }

  public final EntityUtil.Fields getFields(String fields) {
    return repository.getFields(fields);
  }

  private String buildEntityUrl(EntityInterface entityInterface) {
    return decorator.getEntityUrl(Entity.TAG, entityInterface.getFullyQualifiedName(), "");
  }
}
