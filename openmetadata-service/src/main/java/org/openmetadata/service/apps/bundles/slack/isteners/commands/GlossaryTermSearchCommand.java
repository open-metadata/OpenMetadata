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
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.formatter.decorators.SlackMessageDecorator;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.util.EntityUtil;

public class GlossaryTermSearchCommand implements SlashCommandHandler {
  SlackMessageDecorator decorator;
  protected final GlossaryTermRepository repository =
      (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
  final String FIELDS = "children,reviewers,owner,tags,usageCount,domain,extension,childrenCount";

  public GlossaryTermSearchCommand(SlackMessageDecorator decorator) {
    this.decorator = decorator;
  }

  @Override
  public Response apply(SlashCommandRequest req, SlashCommandContext ctx)
      throws IOException, SlackApiException {
    String termFqn = req.getPayload().getText().trim();

    GlossaryTerm glossaryTerm;
    try {
      glossaryTerm = fetchData(termFqn);
    } catch (EntityNotFoundException e) {
      ctx.logger.error("GlossaryTerm not found: {}", e.getMessage());
      return ctx.ack(":warning: GlossaryTerm not found with the provided name.");
    } catch (Exception e) {
      ctx.logger.error("Error fetching glossary data", e);
      return ctx.ack(":x: Failed to fetch glossary term data. Please try again later.");
    }

    List<LayoutBlock> blocks = createMessage(glossaryTerm);

    ChatPostMessageResponse response =
        ctx.client()
            .chatPostMessage(r -> r.channel(req.getPayload().getChannelId()).blocks(blocks));

    if (!response.isOk()) {
      return ctx.ack("Failed to send message: " + response.getError());
    }

    return ctx.ack();
  }

  private List<LayoutBlock> createMessage(GlossaryTerm glossaryTerm) {
    List<LayoutBlock> blocks = new ArrayList<>();

    // Header
    blocks.add(
        Blocks.header(header -> header.text(BlockCompositions.plainText("Glossary Term Details"))));

    // Name and Description
    blocks.add(
        Blocks.section(
            section ->
                section.text(
                    BlockCompositions.markdownText(
                        "*Term Name:* "
                            + glossaryTerm.getName()
                            + "\n"
                            + "*Display Name:* "
                            + glossaryTerm.getDisplayName()
                            + "\n"
                            + "*Description:* "
                            + glossaryTerm.getDescription()))));

    // Divider
    blocks.add(Blocks.divider());

    // Additional Information
    List<TextObject> fields = new ArrayList<>();
    fields.add(
        BlockCompositions.markdownText(
            "*Fully Qualified Name:* " + glossaryTerm.getFullyQualifiedName()));
    fields.add(BlockCompositions.markdownText("*Version:* " + glossaryTerm.getVersion()));
    fields.add(
        BlockCompositions.markdownText(
            "*Updated At:* " + new Date(glossaryTerm.getUpdatedAt()).toString()));
    fields.add(BlockCompositions.markdownText("*Updated By:* " + glossaryTerm.getUpdatedBy()));
    fields.add(BlockCompositions.markdownText("*Provider:* " + glossaryTerm.getProvider()));
    fields.add(
        BlockCompositions.markdownText(
            "*Mutually Exclusive:* " + glossaryTerm.getMutuallyExclusive()));
    fields.add(BlockCompositions.markdownText("*Usage Count:* " + glossaryTerm.getUsageCount()));
    fields.add(
        BlockCompositions.markdownText("*Children Count:* " + glossaryTerm.getChildrenCount()));

    // Owner
    if (glossaryTerm.getOwner() != null) {
      EntityReference owner = glossaryTerm.getOwner();
      fields.add(
          BlockCompositions.markdownText(
              "*Owner:* " + owner.getDisplayName() + " (" + owner.getName() + ")"));
    }

    // Reviewers
    if (glossaryTerm.getReviewers() != null && !glossaryTerm.getReviewers().isEmpty()) {
      String reviewers =
          glossaryTerm.getReviewers().stream()
              .map(EntityReference::getDisplayName)
              .collect(Collectors.joining(", "));
      fields.add(BlockCompositions.markdownText("*Reviewers:* " + reviewers));
    }

    // Tags
    if (glossaryTerm.getTags() != null && !glossaryTerm.getTags().isEmpty()) {
      String tags =
          glossaryTerm.getTags().stream().map(TagLabel::getName).collect(Collectors.joining(", "));
      fields.add(BlockCompositions.markdownText("*Tags:* " + tags));
    }

    // Domain
    if (glossaryTerm.getDomain() != null) {
      EntityReference domain = glossaryTerm.getDomain();
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
                            "Glossary Term provided by OpenMetadata")))));

    // Button Block
    String entityUrl = buildEntityUrl(glossaryTerm); // issue in building entityUrl.
    blocks.add(
        ActionsBlock.builder()
            .elements(
                List.of(
                    ButtonElement.builder()
                        .text(PlainTextObject.builder().text("Open Term").build())
                        .url("https://open-metadata.org/")
                        .build()))
            .build());

    return blocks;
  }

  public GlossaryTerm fetchData(String fqn) {
    EntityUtil.Fields fields = getFields(FIELDS);
    return repository.getByName(null, fqn, fields, Include.NON_DELETED, false);
  }

  public final EntityUtil.Fields getFields(String fields) {
    return repository.getFields(fields);
  }

  private String buildEntityUrl(EntityInterface entityInterface) {
    return decorator.getEntityUrl(
        Entity.GLOSSARY_TERM, entityInterface.getFullyQualifiedName(), "");
  }
}
