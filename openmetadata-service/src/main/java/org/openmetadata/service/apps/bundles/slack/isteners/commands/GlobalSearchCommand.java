package org.openmetadata.service.apps.bundles.slack.isteners.commands;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.slack.api.bolt.context.builtin.SlashCommandContext;
import com.slack.api.bolt.handler.builtin.SlashCommandHandler;
import com.slack.api.bolt.request.builtin.SlashCommandRequest;
import com.slack.api.bolt.response.Response;
import com.slack.api.methods.SlackApiException;
import com.slack.api.model.block.Blocks;
import com.slack.api.model.block.LayoutBlock;
import com.slack.api.model.block.composition.BlockCompositions;
import com.slack.api.model.block.composition.MarkdownTextObject;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.formatter.decorators.SlackMessageDecorator;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchRequest;

public class GlobalSearchCommand implements SlashCommandHandler {
  private final SlackMessageDecorator decorator;
  private final SearchRepository searchRepository;
  private final ObjectMapper objectMapper;

  // Mapping of searchable entity types to their corresponding search indices.
  // /search entityType query
  private static final Map<String, String> searchIndexMap;

  static {
    searchIndexMap =
        new HashMap<>(
            Map.ofEntries(
                Map.entry("table", "table_search_index"),
                Map.entry("topic", "topic_search_index"),
                Map.entry("dashboard", "dashboard_search_index"),
                Map.entry("pipeline", "pipeline_search_index"),
                Map.entry("mlmodel", "mlmodel_search_index"),
                Map.entry("container", "container_search_index"),
                Map.entry("stored procedure", "stored_procedure_search_index"),
                Map.entry("dashboarddatamodel", "dashboard_data_model_search_index"),
                Map.entry("glossary", "glossary_search_index"),
                Map.entry("glossaryterm", "glossary_term_search_index"),
                Map.entry("tag", "tag_search_index"),
                Map.entry("searchindex", "search_entity_search_index"),
                Map.entry("dataproduct", "data_product_search_index")));
  }

  public GlobalSearchCommand(SlackMessageDecorator decorator) {
    this.decorator = decorator;
    this.searchRepository = Entity.getSearchRepository();
    this.objectMapper = new ObjectMapper();
  }

  @Override
  public Response apply(SlashCommandRequest req, SlashCommandContext ctx)
      throws IOException, SlackApiException {

    if (StringUtils.isBlank(req.getPayload().getText())) {
      return ctx.ack("Please provide a search query.");
    }

    String[] parts = req.getPayload().getText().trim().split("\\s+", 2);

    String query = StringUtils.EMPTY;
    String index = "dataAsset";

    if (parts.length == 1) {
      query = parts[0].trim().toLowerCase();

    } else if (parts.length == 2) {
      query = parts[1].trim().toLowerCase();
      index = searchIndexMap.getOrDefault(parts[0].trim().toLowerCase(), index);
    }

    ctx.ack("Processing your search query. This may take a few seconds.");

    try (javax.ws.rs.core.Response searchResponse = search(query, index)) {
      if (searchResponse.getStatus() == 200) {
        Map<String, Object> responseBody =
            objectMapper.readValue(
                searchResponse.getEntity().toString(), new TypeReference<Map<String, Object>>() {});

        Map<String, List<String>> entityTypeToFqns = extractEntityTypeAndFqns(responseBody);
        List<LayoutBlock> blocks = buildMessageBlocks(entityTypeToFqns);

        ctx.say(blocks);
      } else {
        ctx.respond("Search failed with status: " + searchResponse.getStatus());
      }
    }
    return ctx.ack();
  }

  private List<LayoutBlock> buildMessageBlocks(Map<String, List<String>> entityTypeToFqns) {
    List<LayoutBlock> blocks = new ArrayList<>();

    blocks.add(Blocks.header(header -> header.text(BlockCompositions.plainText("Search Result:"))));

    entityTypeToFqns.forEach(
        (entityType, fqn) -> {
          blocks.add(
              Blocks.section(
                  section ->
                      section.text(
                          MarkdownTextObject.builder()
                              .verbatim(true)
                              .text("*" + entityType + "* - " + fqn)
                              .build())));
        });

    return blocks;
  }

  // search using entityType and fqn
  // DataAsset default value for entityType
  private javax.ws.rs.core.Response search(String query, String entityType) throws IOException {
    SearchRequest request =
        new SearchRequest.ElasticSearchRequestBuilder(
                query, 15, Entity.getSearchRepository().getIndexOrAliasName(entityType))
            .from(0)
            .queryFilter(null)
            .postFilter(null)
            .fetchSource(true)
            .trackTotalHits(false)
            .sortFieldParam("_score")
            .deleted(false)
            .sortOrder("desc")
            .includeSourceFields(new ArrayList<>())
            .getHierarchy(false)
            .build();

    return searchRepository.search(request);
  }

  public static Map<String, List<String>> extractEntityTypeAndFqns(
      Map<String, Object> responseBody) {
    Map<String, List<String>> entityTypeToFqns = new HashMap<>();

    if (responseBody.containsKey("hits")) {
      Map<String, Object> hitsMap = (Map<String, Object>) responseBody.get("hits");
      List<Map<String, Object>> hits = (List<Map<String, Object>>) hitsMap.get("hits");

      hits.forEach(
          hit -> {
            Map<String, Object> source = (Map<String, Object>) hit.get("_source");
            if (source != null
                && source.containsKey("fullyQualifiedName")
                && source.containsKey("entityType")) {
              String fqn = (String) source.get("fullyQualifiedName");
              String entityType = (String) source.get("entityType");
              if (fqn != null && !fqn.isEmpty() && entityType != null && !entityType.isEmpty()) {
                entityTypeToFqns.computeIfAbsent(entityType, k -> new ArrayList<>()).add(fqn);
              } else {
                // Skipping entry with empty fqn or entityType
              }
            } else {
              // Skipping entry with missing fields
            }
          });
    } else {
      // No hits found in responseBody
    }

    return entityTypeToFqns;
  }
}
