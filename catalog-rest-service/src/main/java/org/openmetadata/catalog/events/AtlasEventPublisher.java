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
import lombok.Builder;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONArray;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.events.errors.AtlasEntityNotFoundException;
import org.openmetadata.catalog.events.errors.EventPublisherException;
import org.openmetadata.catalog.resources.events.EventResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.EventType;
import org.openmetadata.catalog.type.FieldChange;

@Slf4j
public class AtlasEventPublisher extends AbstractEventPublisher {
  private final String username;
  private final String password;
  private final String atlasUrl;
  private final String tableEntityName;
  private final List<String> atlasTags;
  private final HttpClient client;

  private static final String DSL = "/api/atlas/v2/search/dsl";
  private static final String TAG_CREATE = "/api/atlas/v2/types/typedefs?type=classification";
  private static final String TAG_LIST = "/api/atlas/v2/types/typedefs?type=classification";
  private static final String TAG_ENTITY_CREATE = "/api/atlas/v2/entity/bulk/classification";
  private static final String TAG_DELETE = "/api/atlas/v2/entity/guid/%s/classification/%s";

  public AtlasEventPublisher(AtlasConfiguration config) {
    super(config.getBatchSize(), new ArrayList<>());
    String host = config.getHost();
    Integer port = config.getPort();
    username = config.getUsername();
    password = config.getPassword();
    String scheme = config.getScheme();
    tableEntityName = config.getTableEntityName();
    atlasUrl = scheme + "://" + host + ":" + port;
    atlasTags = new ArrayList<>();
    client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();
  }

  @Override
  public void onStart() {
    try {
      String url = atlasUrl + TAG_LIST;
      HttpResponse<String> response = atlasGet(url);
      ObjectMapper mapper = new ObjectMapper();
      JsonNode node = mapper.readTree(response.body());
      if (node.has("errorCode") || !node.has("classificationDefs")) {
        throw new AtlasEntityNotFoundException("Failed to find tags  in Atlas");
      }
      JsonNode tags = node.get("classificationDefs");
      for (JsonNode tag : tags) {
        atlasTags.add(tag.get("name").asText());
      }
    } catch (Exception e) {
      LOG.error("Failed to parse tags", e);
    }
  }

  @Override
  public void publish(EventResource.ChangeEventList events) throws EventPublisherException {
    for (ChangeEvent event : events.getData()) {
      String entityType = event.getEntityType();
      if (Objects.equals(entityType, Entity.TABLE) && event.getEventType() == EventType.ENTITY_UPDATED) {
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
    if (event.getEntity() != null && event.getEventType() == EventType.ENTITY_UPDATED) {
      ChangeDescription changeDescription = event.getChangeDescription();
      Table table = (Table) event.getEntity();
      String tableGuid = findTableInAtlas(table);
      // if there is no matching table in atlas, return here
      if (tableGuid == null) {
        return;
      }
      if (changeDescription != null) {
        if (changeDescription.getFieldsAdded() != null && !changeDescription.getFieldsAdded().isEmpty()) {
          for (FieldChange fieldChange : changeDescription.getFieldsAdded()) {
            if (fieldChange.getName().contains("tags")) {
              List<String> tags = parseTags((String) fieldChange.getNewValue());
              // if there are new tags in OM add them to Atlas
              addOpenMetadataTagsToAtlas(table, tags);
              addTagsToAtlas(tableGuid, tags);
            }
          }
        }
        if (changeDescription.getFieldsDeleted() != null && !changeDescription.getFieldsDeleted().isEmpty()) {
          for (FieldChange fieldChange : changeDescription.getFieldsDeleted()) {
            if (fieldChange.getName().contains("tags")) {
              List<String> tags = parseTags((String) fieldChange.getOldValue());
              deleteTagsFromAtlas(tableGuid, tags);
            }
          }
        }
      }
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

    HttpResponse<String> response = atlasGet(url);
    ObjectMapper mapper = new ObjectMapper();
    JsonNode node = mapper.readTree(response.body());
    if (node.has("errorCode") || !node.has("entities")) {
      throw new AtlasEntityNotFoundException("Failed to find table " + table.getName() + " in Atlas");
    }
    JsonNode entities = node.get("entities");
    return entities.get(0).get("guid").asText();
  }

  private void addOpenMetadataTagsToAtlas(Table table, List<String> tags)
      throws URISyntaxException, IOException, InterruptedException {
    String url = atlasUrl + TAG_CREATE;
    for (String tag : tags) {
      if (!atlasTags.contains(tag)) {
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

        HttpResponse<String> response = atlasPost(url, payload);
        if (response.statusCode() == 200 || response.statusCode() == 201) {
          atlasTags.add(tag);
        }
      }
    }
  }

  private void addTagsToAtlas(String tableGuid, List<String> tags)
      throws IOException, URISyntaxException, InterruptedException {
    for (String tag : tags) {
      String payload =
          "{"
              + "  \"classification\": "
              + "    {"
              + "      \"typeName\": \""
              + tag
              + "\"},"
              + "      \"entityGuids\": [\""
              + tableGuid
              + "\"]"
              + "}";
      String url = atlasUrl + TAG_ENTITY_CREATE;
      HttpResponse<String> response = atlasPost(url, payload);
      LOG.info(response.body());
    }
  }

  private void deleteTagsFromAtlas(String tableGuid, List<String> tags)
      throws URISyntaxException, IOException, InterruptedException {
    for (String tag : tags) {
      String url = String.format(atlasUrl + TAG_DELETE, tableGuid, tag);
      atlasDelete(url);
    }
  }

  private List<String> parseTags(String tags) {
    JSONArray jsonTags = new JSONArray(tags);
    List<String> tagList = new ArrayList<>();
    for (int i = 0; i < jsonTags.length(); i++) {
      String tagFQN = jsonTags.getJSONObject(i).getString("tagFQN");
      tagList.add(tagFQN);
    }
    return tagList;
  }

  private HttpResponse<String> atlasGet(String url) throws URISyntaxException, IOException, InterruptedException {
    var request = HttpRequest.newBuilder().uri(new URI(url)).header("Authorization", basicAuth()).build();
    HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
    return response;
  }

  private HttpResponse<String> atlasPost(String url, String payload)
      throws IOException, URISyntaxException, InterruptedException {
    var request =
        HttpRequest.newBuilder()
            .uri(new URI(url))
            .header("Authorization", basicAuth())
            .header("Content-Type", "application/json")
            .header("charset", "UTF-8")
            .POST(HttpRequest.BodyPublishers.ofString(payload))
            .build();
    return client.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private HttpResponse<String> atlasDelete(String url) throws URISyntaxException, IOException, InterruptedException {
    var request =
        HttpRequest.newBuilder()
            .uri(new URI(url))
            .header("Authorization", basicAuth())
            .header("Content-Type", "application/json")
            .header("charset", "UTF-8")
            .DELETE()
            .build();
    return client.send(request, HttpResponse.BodyHandlers.ofString());
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
