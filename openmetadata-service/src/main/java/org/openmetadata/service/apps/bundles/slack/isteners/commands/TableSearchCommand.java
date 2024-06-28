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
import java.util.List;
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.formatter.decorators.SlackMessageDecorator;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.util.EntityUtil;

public class TableSearchCommand implements SlashCommandHandler {
  SlackMessageDecorator decorator;
  protected final TableRepository repository =
      (TableRepository) Entity.getEntityRepository(Entity.TABLE);
  final String FIELDS = "tableConstraints,owner," + "tags,followers,extension,domain,dataProducts";

  public TableSearchCommand(SlackMessageDecorator decorator) {
    this.decorator = decorator;
  }

  @Override
  public Response apply(SlashCommandRequest req, SlashCommandContext ctx)
      throws IOException, SlackApiException {
    ctx.logger.info("Search glossary responding");
    String fqn = req.getPayload().getText().trim();

    ctx.logger.info("fqn : {}", fqn);

    Table table;
    try {
      table = fetchData(fqn);
    } catch (EntityNotFoundException e) {
      ctx.logger.error("Table not found: {}", e.getMessage());
      return ctx.ack(":warning: Table not found with the provided name.");
    } catch (Exception e) {
      ctx.logger.error("Error fetching table data", e);
      return ctx.ack(":x: Failed to fetch table data. Please try again later.");
    }

    List<LayoutBlock> blocks = createMessage(table);

    ChatPostMessageResponse response =
        ctx.client()
            .chatPostMessage(r -> r.channel(req.getPayload().getChannelId()).blocks(blocks));

    if (!response.isOk()) {
      return ctx.ack("Failed to send message: " + response.getError());
    }

    return ctx.ack();
  }

  private List<LayoutBlock> createMessage(Table table) {
    List<LayoutBlock> blocks = new ArrayList<>();

    // Header
    blocks.add(Blocks.header(header -> header.text(BlockCompositions.plainText("Table Details"))));

    // Name and Display Name
    blocks.add(
        Blocks.section(
            section ->
                section.text(
                    BlockCompositions.markdownText(
                        "*Table Name:* "
                            + table.getName()
                            + "\n*Display Name:* "
                            + table.getDisplayName()))));

    // Divider
    blocks.add(Blocks.divider());

    // Description
    blocks.add(
        Blocks.section(
            section ->
                section.text(
                    BlockCompositions.markdownText("*Description:* " + table.getDescription()))));

    blocks.add(Blocks.divider());

    // Additional Information
    List<TextObject> fields = new ArrayList<>();
    fields.add(
        BlockCompositions.markdownText("*Fully Qualified Name:* " + table.getFullyQualifiedName()));

    // Owner
    if (table.getOwner() != null) {
      fields.add(BlockCompositions.markdownText("*Owner:* " + table.getOwner().getName()));
    }

    // Tags
    if (table.getTags() != null && !table.getTags().isEmpty()) {
      String tags =
          table.getTags().stream().map(tag -> tag.getTagFQN()).collect(Collectors.joining(", "));
      fields.add(BlockCompositions.markdownText("*Tags:* " + tags));
    }

    // Constraints
    if (table.getTableConstraints() != null && !table.getTableConstraints().isEmpty()) {
      String constraints =
          table.getTableConstraints().stream()
              .map(
                  constraint -> {
                    String columns = String.join(", ", constraint.getColumns());
                    return constraint.getConstraintType().toString() + " (" + columns + ")";
                  })
              .collect(Collectors.joining(", "));
      fields.add(BlockCompositions.markdownText("*Constraints:* " + constraints));
    }

    // Followers
    if (table.getFollowers() != null && !table.getFollowers().isEmpty()) {
      String followers =
          table.getFollowers().stream()
              .map(follower -> follower.getName())
              .collect(Collectors.joining(", "));
      fields.add(BlockCompositions.markdownText("*Followers:* " + followers));
    }

    // Domain
    if (table.getDomain() != null) {
      fields.add(BlockCompositions.markdownText("*Domain:* " + table.getDomain().getName()));
    }

    // Data Products
    if (table.getDataProducts() != null && !table.getDataProducts().isEmpty()) {
      String dataProducts =
          table.getDataProducts().stream()
              .map(dataProduct -> dataProduct.getName())
              .collect(Collectors.joining(", "));
      fields.add(BlockCompositions.markdownText("*Data Products:* " + dataProducts));
    }

    // Extension
    if (table.getExtension() != null) {
      fields.add(BlockCompositions.markdownText("*Extension:* " + table.getExtension()));
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
                    List.of(BlockCompositions.markdownText("Table provided by OpenMetadata")))));

    // Button Block
    String entityUrl = buildEntityUrl(table); // issue in building entityUrl.
    if (entityUrl.isEmpty()) entityUrl = "";
    blocks.add(
        ActionsBlock.builder()
            .elements(
                List.of(
                    ButtonElement.builder()
                        .text(PlainTextObject.builder().text("Open Table").build())
                        .url("https://open-metadata.org/")
                        .build()))
            .build());

    return blocks;
  }

  public Table fetchData(String fqn) {
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
