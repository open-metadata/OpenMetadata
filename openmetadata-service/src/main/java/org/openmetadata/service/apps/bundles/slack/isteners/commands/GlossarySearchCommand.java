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
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.formatter.decorators.SlackMessageDecorator;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.util.EntityUtil;

public class GlossarySearchCommand implements SlashCommandHandler {
  protected final GlossaryRepository repository =
      (GlossaryRepository) Entity.getEntityRepository(Entity.GLOSSARY);
  final String FIELDS = "owner,tags,reviewers,usageCount,termCount,domain,extension";
  SlackMessageDecorator decorator;

  public GlossarySearchCommand(SlackMessageDecorator decorator) {
    this.decorator = decorator;
  }

  @Override
  public Response apply(SlashCommandRequest req, SlashCommandContext ctx)
      throws IOException, SlackApiException {
    String fqn = req.getPayload().getText().trim();

    Glossary glossary;
    try {
      glossary = fetchData(fqn);
    } catch (EntityNotFoundException e) {
      ctx.logger.error("Glossary not found: {}", e.getMessage());
      return ctx.ack(":warning: Glossary not found with the provided name.");
    } catch (Exception e) {
      ctx.logger.error("Error fetching glossary data", e);
      return ctx.ack(":x: Failed to fetch glossary data. Please try again later.");
    }

    // Continue processing with glossary data
    List<LayoutBlock> blocks = createMessage(glossary);

    ChatPostMessageResponse response =
        ctx.client()
            .chatPostMessage(r -> r.channel(req.getPayload().getChannelId()).blocks(blocks));

    if (!response.isOk()) {
      return ctx.ack("Failed to send message: " + response.getError());
    }

    return ctx.ack();
  }

  private List<LayoutBlock> createMessage(Glossary glossary) {
    List<LayoutBlock> blocks = new ArrayList<>();

    // Header
    blocks.add(
        Blocks.header(header -> header.text(BlockCompositions.plainText("Glossary Details"))));

    // Name and Description
    blocks.add(
        Blocks.section(
            section ->
                section.text(
                    BlockCompositions.markdownText(
                        "*Name:* "
                            + glossary.getName()
                            + "\n"
                            + "*Display Name:* "
                            + glossary.getDisplayName()
                            + "\n"
                            + "*Description:* "
                            + glossary.getDescription()))));

    // Divider
    blocks.add(Blocks.divider());

    // Additional Information
    List<TextObject> fields = new ArrayList<>();
    fields.add(
        BlockCompositions.markdownText(
            "*Fully Qualified Name:* " + glossary.getFullyQualifiedName()));
    fields.add(BlockCompositions.markdownText("*Version:* " + glossary.getVersion()));
    fields.add(
        BlockCompositions.markdownText(
            "*Updated At:* " + new Date(glossary.getUpdatedAt()).toString()));
    fields.add(BlockCompositions.markdownText("*Updated By:* " + glossary.getUpdatedBy()));
    fields.add(BlockCompositions.markdownText("*Provider:* " + glossary.getProvider()));
    fields.add(
        BlockCompositions.markdownText("*Mutually Exclusive:* " + glossary.getMutuallyExclusive()));
    fields.add(BlockCompositions.markdownText("*Usage Count:* " + glossary.getUsageCount()));
    fields.add(BlockCompositions.markdownText("*Term Count:* " + glossary.getTermCount()));

    // Owner
    if (glossary.getOwner() != null) {
      EntityReference owner = glossary.getOwner();
      fields.add(
          BlockCompositions.markdownText(
              "*Owner:* " + owner.getDisplayName() + " (" + owner.getName() + ")"));
    }

    // Reviewers
    if (glossary.getReviewers() != null && !glossary.getReviewers().isEmpty()) {
      String reviewers =
          glossary.getReviewers().stream()
              .map(EntityReference::getDisplayName)
              .collect(Collectors.joining(", "));
      fields.add(BlockCompositions.markdownText("*Reviewers:* " + reviewers));
    }

    // Tags
    if (glossary.getTags() != null && !glossary.getTags().isEmpty()) {
      String tags =
          glossary.getTags().stream().map(TagLabel::getName).collect(Collectors.joining(", "));
      fields.add(BlockCompositions.markdownText("*Tags:* " + tags));
    }

    // Domain
    if (glossary.getDomain() != null) {
      EntityReference domain = glossary.getDomain();
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
                    List.of(BlockCompositions.markdownText("Glossary provided by OpenMetadata")))));

    // Button Block
    String entityUrl = buildEntityUrl(glossary); // issue in building entityUrl.
    if (entityUrl.isEmpty()) entityUrl = "";
    blocks.add(
        ActionsBlock.builder()
            .elements(
                List.of(
                    ButtonElement.builder()
                        .text(PlainTextObject.builder().text("Open Glossary").build())
                        .url("https://open-metadata.org/")
                        .build()))
            .build());

    return blocks;
  }

  public Glossary fetchData(String fqn) {
    EntityUtil.Fields fields = getFields(FIELDS);
    return repository.getByName(null, fqn, fields, Include.NON_DELETED, false);
  }

  public final EntityUtil.Fields getFields(String fields) {
    return repository.getFields(fields);
  }

  private String buildEntityUrl(EntityInterface entityInterface) {
    return decorator.getEntityUrl(Entity.GLOSSARY, entityInterface.getFullyQualifiedName(), "");
  }
}
