package org.openmetadata.catalog.events;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import lombok.Builder;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.protocol.HttpClientContext;
import org.apache.http.entity.StringEntity;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.events.errors.AtlasEntityNotFoundException;
import org.openmetadata.catalog.events.errors.EventPublisherException;
import org.openmetadata.catalog.resources.events.EventResource;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.EventType;
import org.openmetadata.catalog.type.TagLabel;

@Slf4j
public class AtlasEventPublisher extends AbstractEventPublisher {
  private final String host;
  private final Integer port;
  private final String username;
  private final String password;
  private final String scheme;
  private final String atlasUrl;
  private final String tableEntityName;
  private HttpClient client;
  private HttpClientContext context;

  private static final String DSL = "/api/atlas/v2/search/dsl";
  private static final String TAG_CREATE = "/api/atlas/v2/types/typedefs?type=classification";

  public AtlasEventPublisher(AtlasConfiguration config) {
    super(config.getBatchSize(), new ArrayList<>());
    host = config.getHost();
    port = config.getPort();
    username = config.getUsername();
    password = config.getPassword();
    scheme = config.getScheme();
    tableEntityName = config.getTableEntityName();
    atlasUrl = scheme + "://" + host + ":" + port;
  }

  @Override
  public void onStart() {}

  @Override
  public void publish(EventResource.ChangeEventList events) throws EventPublisherException {
    for (ChangeEvent event : events.getData()) {
      String entityType = event.getEntityType();
      if (Objects.equals(entityType, Entity.TABLE)) {
        try {
          updateAtlas(event);
        } catch (Exception e) {
          LOG.error("failed to update Atlas");
          LOG.debug(e.getMessage());
        }
      }
    }
  }

  public void updateAtlas(ChangeEvent event) throws URISyntaxException, IOException, InterruptedException {
    if (event.getEntity() != null && event.getEventType() != EventType.ENTITY_SOFT_DELETED) {
      Table table = (Table) event.getEntity();
      String tableGuid = findTableInAtlas(table);
      addTags(table);
    }
  }

  private String findTableInAtlas(Table table) throws IOException, InterruptedException, URISyntaxException {
    String atlasQuery = "where name=\"" + table.getName() + "\"";
    String url =
        atlasUrl
            + DSL
            + "?typeName="
            + tableEntityName
            + "&query="
            + (URLEncoder.encode(atlasQuery, StandardCharsets.UTF_8).replace("+", "%20"));

    var client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();
    var request = HttpRequest.newBuilder().uri(new URI(url)).header("Authorization", basicAuth()).build();

    HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
    ObjectMapper mapper = new ObjectMapper();
    JsonNode node = mapper.readTree(response.body());
    if (node.has("errorCode") || !node.has("entities")) {
      throw new AtlasEntityNotFoundException("Failed to find table " + table.getName() + " in Atlas");
    }
    JsonNode entities = node.get("entities");
    return entities.get(0).get("guid").asText();
  }

  private void addTags(Table table) throws URISyntaxException, IOException, InterruptedException {
    List<String> tags = new ArrayList<>();
    if (table.getTags() != null) {
      table.getTags().forEach(tag -> tags.add(tag.getTagFQN()));
    }
    if (table.getColumns() != null) {
      List<FlattenColumn> cols = new ArrayList<>();
      cols = parseColumns(table.getColumns(), cols, null);

      for (FlattenColumn col : cols) {
        if (col.getTags() != null) {
          tags.addAll(col.getTags());
        }
      }
    }
    String url = atlasUrl + TAG_CREATE;
    var client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    for (String tag : tags) {
      String payload =
          "{"
              + "  \"classificationDefs\": ["
              + "    {"
              + "      \"name\": \""
              + tag
              + "\","
              + "      \"description\": \"\""
              + "    }"
              + "  ]"
              + "}";
      StringEntity entity = new StringEntity(payload);
      var request =
          HttpRequest.newBuilder()
              .uri(new URI(url))
              .header("Authorization", basicAuth())
              .header("Content-Type", "application/json")
              .header("charset", "UTF-8")
              .POST(HttpRequest.BodyPublishers.ofString(payload))
              .build();
      HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
      LOG.info(response.body());
    }
  }

  public static List<FlattenColumn> parseColumns(
      List<Column> columns, List<FlattenColumn> flattenColumns, String parentColumn) {
    Optional<String> optParentColumn = Optional.ofNullable(parentColumn).filter(Predicate.not(String::isEmpty));
    List<String> tags = new ArrayList<>();
    for (Column col : columns) {
      String columnName = col.getName();
      if (optParentColumn.isPresent()) {
        columnName = optParentColumn.get() + "." + columnName;
      }
      if (col.getTags() != null) {
        tags = col.getTags().stream().map(TagLabel::getTagFQN).collect(Collectors.toList());
      }

      FlattenColumn flattenColumn = FlattenColumn.builder().name(columnName).description(col.getDescription()).build();

      if (!tags.isEmpty()) {
        flattenColumn.tags = tags;
      }
      flattenColumns.add(flattenColumn);
      if (col.getChildren() != null) {
        parseColumns(col.getChildren(), flattenColumns, col.getName());
      }
    }
    return flattenColumns;
  }

  private String basicAuth() {
    return "Basic " + Base64.getEncoder().encodeToString((username + ":" + password).getBytes());
  }

  @Override
  public void onShutdown() {
    LOG.info("Shutting down AtlasEventPublisher");
  }
}

@Getter
@Builder
class FlattenColumn {
  String name;
  String description;
  List<String> tags;
}
