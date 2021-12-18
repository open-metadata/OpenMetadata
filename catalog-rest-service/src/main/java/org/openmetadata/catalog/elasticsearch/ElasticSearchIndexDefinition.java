package org.openmetadata.catalog.elasticsearch;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import javax.ws.rs.core.Response;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;
import lombok.Value;
import lombok.experimental.SuperBuilder;
import org.elasticsearch.action.admin.indices.delete.DeleteIndexRequest;
import org.elasticsearch.action.support.master.AcknowledgedResponse;
import org.elasticsearch.client.RequestOptions;
import org.elasticsearch.client.RestHighLevelClient;
import org.elasticsearch.client.indices.CreateIndexRequest;
import org.elasticsearch.client.indices.CreateIndexResponse;
import org.elasticsearch.client.indices.GetIndexRequest;
import org.elasticsearch.client.indices.PutMappingRequest;
import org.elasticsearch.common.xcontent.XContentType;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.entity.data.Pipeline;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.data.Topic;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.type.Task;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ElasticSearchIndexDefinition {
  final Map<ElasticSearchIndexType, ElasticSearchIndexStatus> elasticSearchIndexes = new HashMap<>();
  private final RestHighLevelClient client;
  private static final Logger LOG = LoggerFactory.getLogger(ElasticSearchIndexDefinition.class);

  public ElasticSearchIndexDefinition(RestHighLevelClient client) {
    this.client = client;
    for (ElasticSearchIndexType elasticSearchIndexType : ElasticSearchIndexType.values()) {
      elasticSearchIndexes.put(elasticSearchIndexType, ElasticSearchIndexStatus.NOT_CREATED);
    }
  }

  public enum ElasticSearchIndexStatus {
    CREATED,
    NOT_CREATED,
    FAILED
  }

  public enum ElasticSearchIndexType {
    TABLE_SEARCH_INDEX("table_search_index", "/elasticsearch/table_index_mapping.json"),
    TOPIC_SEARCH_INDEX("topic_search_index", "/elasticsearch/topic_index_mapping.json"),
    DASHBOARD_SEARCH_INDEX("dashboard_search_index", "/elasticsearch/dashboard_index_mapping.json"),
    PIPELINE_SEARCH_INDEX("pipeline_search_index", "/elasticsearch/pipeline_index_mapping.json");

    public final String indexName;
    public final String indexMappingFile;

    ElasticSearchIndexType(String indexName, String indexMappingFile) {
      this.indexName = indexName;
      this.indexMappingFile = indexMappingFile;
    }
  }

  public void createIndexes() {
    try {
      for (ElasticSearchIndexType elasticSearchIndexType : ElasticSearchIndexType.values()) {
        createIndex(elasticSearchIndexType);
      }
    } catch (Exception e) {
      LOG.error("Failed to created Elastic Search indexes due to", e);
    }
  }

  public void updateIndexes() {
    try {
      for (ElasticSearchIndexType elasticSearchIndexType : ElasticSearchIndexType.values()) {
        updateIndex(elasticSearchIndexType);
      }
    } catch (Exception e) {
      LOG.error("Failed to created Elastic Search indexes due to", e);
    }
  }

  public void dropIndexes() {
    try {
      for (ElasticSearchIndexType elasticSearchIndexType : ElasticSearchIndexType.values()) {
        deleteIndex(elasticSearchIndexType);
      }
    } catch (Exception e) {
      LOG.error("Failed to delete Elastic Search indexes due to", e);
    }
  }

  public boolean checkIndexExistsOrCreate(ElasticSearchIndexType indexType) {
    boolean exists = elasticSearchIndexes.get(indexType) == ElasticSearchIndexStatus.CREATED;
    if (!exists) {
      exists = createIndex(indexType);
    }
    return exists;
  }

  private boolean createIndex(ElasticSearchIndexType elasticSearchIndexType) {
    try {
      GetIndexRequest gRequest = new GetIndexRequest(elasticSearchIndexType.indexName);
      gRequest.local(false);
      boolean exists = client.indices().exists(gRequest, RequestOptions.DEFAULT);
      if (!exists) {
        String elasticSearchIndexMapping = getIndexMapping(elasticSearchIndexType);
        CreateIndexRequest request = new CreateIndexRequest(elasticSearchIndexType.indexName);
        request.mapping(elasticSearchIndexMapping, XContentType.JSON);
        CreateIndexResponse createIndexResponse = client.indices().create(request, RequestOptions.DEFAULT);
        LOG.info(elasticSearchIndexType.indexName + " Created " + createIndexResponse.isAcknowledged());
      }
      setIndexStatus(elasticSearchIndexType, ElasticSearchIndexStatus.CREATED);
    } catch (Exception e) {
      setIndexStatus(elasticSearchIndexType, ElasticSearchIndexStatus.FAILED);
      LOG.error("Failed to created Elastic Search indexes due to", e);
      return false;
    }
    return true;
  }

  private boolean updateIndex(ElasticSearchIndexType elasticSearchIndexType) {
    try {
      GetIndexRequest gRequest = new GetIndexRequest(elasticSearchIndexType.indexName);
      gRequest.local(false);
      boolean exists = client.indices().exists(gRequest, RequestOptions.DEFAULT);
      String elasticSearchIndexMapping = getIndexMapping(elasticSearchIndexType);
      if (exists) {
        PutMappingRequest request = new PutMappingRequest(elasticSearchIndexType.indexName);
        request.source(elasticSearchIndexMapping, XContentType.JSON);
        AcknowledgedResponse putMappingResponse = client.indices().putMapping(request, RequestOptions.DEFAULT);
        LOG.info(elasticSearchIndexType.indexName + " Updated " + putMappingResponse.isAcknowledged());
      } else {
        CreateIndexRequest request = new CreateIndexRequest(elasticSearchIndexType.indexName);
        request.mapping(elasticSearchIndexMapping, XContentType.JSON);
        CreateIndexResponse createIndexResponse = client.indices().create(request, RequestOptions.DEFAULT);
        LOG.info(elasticSearchIndexType.indexName + " Created " + createIndexResponse.isAcknowledged());
      }
      setIndexStatus(elasticSearchIndexType, ElasticSearchIndexStatus.CREATED);
    } catch (Exception e) {
      setIndexStatus(elasticSearchIndexType, ElasticSearchIndexStatus.FAILED);
      LOG.error("Failed to created Elastic Search indexes due to", e);
      return false;
    }
    return true;
  }

  private boolean deleteIndex(ElasticSearchIndexType elasticSearchIndexType) {
    try {
      DeleteIndexRequest request = new DeleteIndexRequest(elasticSearchIndexType.indexName);
      AcknowledgedResponse deleteIndexResponse = client.indices().delete(request, RequestOptions.DEFAULT);
      LOG.info(elasticSearchIndexType.indexName + " Deleted " + deleteIndexResponse.isAcknowledged());
    } catch (IOException e) {
      LOG.error("Failed to delete Elastic Search indexes due to", e);
      return false;
    }
    return true;
  }

  private void setIndexStatus(ElasticSearchIndexType indexType, ElasticSearchIndexStatus elasticSearchIndexStatus) {
    elasticSearchIndexes.put(indexType, elasticSearchIndexStatus);
  }

  public String getIndexMapping(ElasticSearchIndexType elasticSearchIndexType) throws IOException {
    InputStream in = ElasticSearchIndexDefinition.class.getResourceAsStream(elasticSearchIndexType.indexMappingFile);
    return new String(in.readAllBytes());
  }

  public ElasticSearchIndexType getIndexMappingByEntityType(String type) {
    if (type.equalsIgnoreCase(Entity.TABLE)) {
      return ElasticSearchIndexType.TABLE_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.DASHBOARD)) {
      return ElasticSearchIndexType.DASHBOARD_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.PIPELINE)) {
      return ElasticSearchIndexType.PIPELINE_SEARCH_INDEX;
    } else if (type.equalsIgnoreCase(Entity.TOPIC)) {
      return ElasticSearchIndexType.TOPIC_SEARCH_INDEX;
    }
    throw new RuntimeException("Failed to find index doc for type " + type);
  }
}

@SuperBuilder
@Data
class ElasticSearchIndex {
  String name;

  @JsonProperty("display_name")
  String displayName;

  String fqdn;
  String service;

  @JsonProperty("service_type")
  String serviceType;

  @JsonProperty("service_category")
  String serviceCategory;

  @JsonProperty("entity_type")
  String entityType;

  List<ElasticSearchSuggest> suggest;
  String description;
  String tier;
  List<String> tags;
  String owner;
  List<String> followers;

  @JsonProperty("last_updated_timestamp")
  @Builder.Default
  Long lastUpdatedTimestamp = System.currentTimeMillis();

  @JsonProperty("change_descriptions")
  List<ESChangeDescription> changeDescriptions;
}

@Getter
@Builder
class ElasticSearchSuggest {
  String input;
  Integer weight;
}

@Getter
@Builder
class FlattenColumn {
  String name;
  String description;
  List<String> tags;
}

@Getter
@Setter
@Builder
class ESChangeDescription {
  String updatedBy;
  Long updatedAt;
  List<FieldChange> fieldsAdded;
  List<FieldChange> fieldsUpdated;
  List<FieldChange> fieldsDeleted;
}

class ParseTags {
  String tierTag;
  final List<String> tags;

  ParseTags(List<String> tags) {
    if (!tags.isEmpty()) {
      List<String> tagsList = new ArrayList<>(tags);
      String tierTag = null;
      for (String tag : tagsList) {
        if (tag.toLowerCase().matches("(.*)tier(.*)")) {
          tierTag = tag;
          break;
        }
      }
      if (tierTag != null) {
        tagsList.remove(tierTag);
        this.tierTag = tierTag;
      }
      this.tags = tagsList;
    } else {
      this.tags = tags;
    }
  }
}

@EqualsAndHashCode(callSuper = true)
@Getter
@SuperBuilder(builderMethodName = "internalBuilder")
@Value
@JsonInclude(JsonInclude.Include.NON_NULL)
class TableESIndex extends ElasticSearchIndex {

  @JsonProperty("table_id")
  String tableId;

  String database;

  @JsonProperty("table_type")
  String tableType;

  @JsonProperty("column_names")
  List<String> columnNames;

  @JsonProperty("column_descriptions")
  List<String> columnDescriptions;

  @JsonProperty("monthly_stats")
  Integer monthlyStats;

  @JsonProperty("monthly_percentile_rank")
  Integer monthlyPercentileRank;

  @JsonProperty("weekly_stats")
  Integer weeklyStats;

  @JsonProperty("weekly_percentile_rank")
  Integer weeklyPercentileRank;

  @JsonProperty("daily_stats")
  Integer dailyStats;

  @JsonProperty("daily_percentile_rank")
  Integer dailyPercentileRank;

  public static TableESIndexBuilder builder(Table table, int responseCode) {
    String tableId = table.getId().toString();
    String tableName = table.getName();
    String description = table.getDescription() != null ? table.getDescription() : "";
    String tableType = table.getTableType() != null ? table.getTableType().toString() : "Regular";
    List<String> tags = new ArrayList<>();
    List<String> columnNames = new ArrayList<>();
    List<String> columnDescriptions = new ArrayList<>();
    List<ElasticSearchSuggest> suggest = new ArrayList<>();
    suggest.add(ElasticSearchSuggest.builder().input(table.getFullyQualifiedName()).weight(5).build());
    suggest.add(ElasticSearchSuggest.builder().input(table.getName()).weight(10).build());

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
        columnDescriptions.add(col.getDescription());
        columnNames.add(col.getName());
      }
    }
    ParseTags parseTags = new ParseTags(tags);
    Long updatedTimestamp = table.getUpdatedAt().getTime();
    TableESIndexBuilder tableESIndexBuilder =
        internalBuilder()
            .tableId(tableId)
            .name(tableName)
            .displayName(tableName)
            .description(description)
            .lastUpdatedTimestamp(updatedTimestamp)
            .fqdn(table.getFullyQualifiedName())
            .suggest(suggest)
            .entityType("table")
            .serviceCategory("databaseService")
            .columnNames(columnNames)
            .columnDescriptions(columnDescriptions)
            .tableType(tableType)
            .tags(parseTags.tags)
            .tier(parseTags.tierTag);

    if (table.getDatabase() != null) {
      String databaseFQN = table.getDatabase().getName();
      String[] databaseFQNSplit = databaseFQN.split("\\.");
      if (databaseFQNSplit.length == 2) {
        tableESIndexBuilder.database(databaseFQNSplit[1]);
      } else {
        tableESIndexBuilder.database(databaseFQNSplit[0]);
      }
    }

    if (table.getService() != null) {
      tableESIndexBuilder.service(table.getService().getName());
      tableESIndexBuilder.serviceType(table.getServiceType().toString());
    }

    if (table.getUsageSummary() != null) {
      tableESIndexBuilder
          .weeklyStats(table.getUsageSummary().getWeeklyStats().getCount())
          .weeklyPercentileRank(table.getUsageSummary().getWeeklyStats().getPercentileRank().intValue())
          .dailyStats(table.getUsageSummary().getDailyStats().getCount())
          .dailyPercentileRank(table.getUsageSummary().getDailyStats().getPercentileRank().intValue())
          .monthlyStats(table.getUsageSummary().getMonthlyStats().getCount())
          .monthlyPercentileRank(table.getUsageSummary().getMonthlyStats().getPercentileRank().intValue());
    }
    if (table.getFollowers() != null) {
      tableESIndexBuilder.followers(
          table.getFollowers().stream().map(item -> item.getId().toString()).collect(Collectors.toList()));
    } else if (responseCode == Response.Status.CREATED.getStatusCode()) {
      tableESIndexBuilder.followers(Collections.emptyList());
    }

    if (table.getOwner() != null) {
      tableESIndexBuilder.owner(table.getOwner().getId().toString());
    }

    ESChangeDescription esChangeDescription = null;

    if (table.getChangeDescription() != null) {
      esChangeDescription =
          ESChangeDescription.builder().updatedAt(updatedTimestamp).updatedBy(table.getUpdatedBy()).build();
      esChangeDescription.setFieldsAdded(table.getChangeDescription().getFieldsAdded());
      esChangeDescription.setFieldsDeleted(table.getChangeDescription().getFieldsDeleted());
      esChangeDescription.setFieldsUpdated(table.getChangeDescription().getFieldsUpdated());
    } else if (responseCode == Response.Status.CREATED.getStatusCode()) {
      esChangeDescription =
          ESChangeDescription.builder()
              .updatedAt(updatedTimestamp)
              .updatedBy(table.getUpdatedBy())
              .fieldsAdded(new ArrayList<>())
              .fieldsUpdated(new ArrayList<>())
              .fieldsDeleted(new ArrayList<>())
              .build();
    }
    tableESIndexBuilder.changeDescriptions(esChangeDescription != null ? List.of(esChangeDescription) : null);
    return tableESIndexBuilder;
  }

  private static List<FlattenColumn> parseColumns(
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
}

@EqualsAndHashCode(callSuper = true)
@Getter
@SuperBuilder(builderMethodName = "internalBuilder")
@Value
@JsonInclude(JsonInclude.Include.NON_NULL)
class TopicESIndex extends ElasticSearchIndex {
  @JsonProperty("topic_id")
  String topicId;

  public static TopicESIndexBuilder builder(Topic topic, int responseCode) {
    List<String> tags = new ArrayList<>();
    List<ElasticSearchSuggest> suggest = new ArrayList<>();
    suggest.add(ElasticSearchSuggest.builder().input(topic.getFullyQualifiedName()).weight(5).build());
    suggest.add(ElasticSearchSuggest.builder().input(topic.getName()).weight(10).build());

    if (topic.getTags() != null) {
      topic.getTags().forEach(tag -> tags.add(tag.getTagFQN()));
    }
    ParseTags parseTags = new ParseTags(tags);
    Long updatedTimestamp = topic.getUpdatedAt().getTime();
    String description = topic.getDescription() != null ? topic.getDescription() : "";
    String displayName = topic.getDisplayName() != null ? topic.getDisplayName() : "";
    TopicESIndexBuilder topicESIndexBuilder =
        internalBuilder()
            .topicId(topic.getId().toString())
            .name(topic.getName())
            .displayName(displayName)
            .description(description)
            .fqdn(topic.getFullyQualifiedName())
            .lastUpdatedTimestamp(updatedTimestamp)
            .suggest(suggest)
            .service(topic.getService().getName())
            .serviceType(topic.getServiceType().toString())
            .serviceCategory("messagingService")
            .entityType("topic")
            .tags(parseTags.tags)
            .tier(parseTags.tierTag);

    if (topic.getFollowers() != null) {
      topicESIndexBuilder.followers(
          topic.getFollowers().stream().map(item -> item.getId().toString()).collect(Collectors.toList()));
    } else if (responseCode == Response.Status.CREATED.getStatusCode()) {
      topicESIndexBuilder.followers(Collections.emptyList());
    }

    if (topic.getOwner() != null) {
      topicESIndexBuilder.owner(topic.getOwner().getId().toString());
    }

    ESChangeDescription esChangeDescription = null;

    if (topic.getChangeDescription() != null) {
      esChangeDescription =
          ESChangeDescription.builder().updatedAt(updatedTimestamp).updatedBy(topic.getUpdatedBy()).build();
      esChangeDescription.setFieldsAdded(topic.getChangeDescription().getFieldsAdded());
      esChangeDescription.setFieldsDeleted(topic.getChangeDescription().getFieldsDeleted());
      esChangeDescription.setFieldsUpdated(topic.getChangeDescription().getFieldsUpdated());
    } else if (responseCode == Response.Status.CREATED.getStatusCode()) {
      esChangeDescription =
          ESChangeDescription.builder().updatedAt(updatedTimestamp).updatedBy(topic.getUpdatedBy()).build();
    }

    topicESIndexBuilder.changeDescriptions(esChangeDescription != null ? List.of(esChangeDescription) : null);

    return topicESIndexBuilder;
  }
}

@EqualsAndHashCode(callSuper = true)
@Getter
@SuperBuilder(builderMethodName = "internalBuilder")
@Value
@JsonInclude(JsonInclude.Include.NON_NULL)
class DashboardESIndex extends ElasticSearchIndex {
  @JsonProperty("dashboard_id")
  String dashboardId;

  @JsonProperty("chart_names")
  List<String> chartNames;

  @JsonProperty("chart_descriptions")
  List<String> chartDescriptions;

  @JsonProperty("monthly_stats")
  Integer monthlyStats;

  @JsonProperty("monthly_percentile_rank")
  Integer monthlyPercentileRank;

  @JsonProperty("weekly_stats")
  Integer weeklyStats;

  @JsonProperty("weekly_percentile_rank")
  Integer weeklyPercentileRank;

  @JsonProperty("daily_stats")
  Integer dailyStats;

  @JsonProperty("daily_percentile_rank")
  Integer dailyPercentileRank;

  public static DashboardESIndexBuilder builder(Dashboard dashboard, int responseCode) {
    List<String> tags = new ArrayList<>();
    List<String> chartNames = new ArrayList<>();
    List<String> chartDescriptions = new ArrayList<>();
    List<ElasticSearchSuggest> suggest = new ArrayList<>();
    suggest.add(ElasticSearchSuggest.builder().input(dashboard.getFullyQualifiedName()).weight(5).build());
    suggest.add(ElasticSearchSuggest.builder().input(dashboard.getDisplayName()).weight(10).build());
    Long updatedTimestamp = dashboard.getUpdatedAt().getTime();
    if (dashboard.getTags() != null) {
      dashboard.getTags().forEach(tag -> tags.add(tag.getTagFQN()));
    }

    for (EntityReference chart : dashboard.getCharts()) {
      chartNames.add(chart.getDisplayName());
      chartDescriptions.add(chart.getDescription());
    }
    ParseTags parseTags = new ParseTags(tags);
    String description = dashboard.getDescription() != null ? dashboard.getDescription() : "";
    String displayName = dashboard.getDisplayName() != null ? dashboard.getDisplayName() : "";
    DashboardESIndexBuilder dashboardESIndexBuilder =
        internalBuilder()
            .dashboardId(dashboard.getId().toString())
            .name(dashboard.getDisplayName())
            .displayName(displayName)
            .description(description)
            .fqdn(dashboard.getFullyQualifiedName())
            .lastUpdatedTimestamp(updatedTimestamp)
            .chartNames(chartNames)
            .chartDescriptions(chartDescriptions)
            .entityType("dashboard")
            .suggest(suggest)
            .service(dashboard.getService().getName())
            .serviceType(dashboard.getServiceType().toString())
            .serviceCategory("dashboardService")
            .tags(parseTags.tags)
            .tier(parseTags.tierTag);

    if (dashboard.getUsageSummary() != null) {
      dashboardESIndexBuilder
          .weeklyStats(dashboard.getUsageSummary().getWeeklyStats().getCount())
          .weeklyPercentileRank(dashboard.getUsageSummary().getWeeklyStats().getPercentileRank().intValue())
          .dailyStats(dashboard.getUsageSummary().getDailyStats().getCount())
          .dailyPercentileRank(dashboard.getUsageSummary().getDailyStats().getPercentileRank().intValue())
          .monthlyStats(dashboard.getUsageSummary().getMonthlyStats().getCount())
          .monthlyPercentileRank(dashboard.getUsageSummary().getMonthlyStats().getPercentileRank().intValue());
    }

    if (dashboard.getFollowers() != null) {
      dashboardESIndexBuilder.followers(
          dashboard.getFollowers().stream().map(item -> item.getId().toString()).collect(Collectors.toList()));
    } else if (responseCode == Response.Status.CREATED.getStatusCode()) {
      dashboardESIndexBuilder.followers(Collections.emptyList());
    }
    if (dashboard.getOwner() != null) {
      dashboardESIndexBuilder.owner(dashboard.getOwner().getId().toString());
    }
    ESChangeDescription esChangeDescription = null;
    if (dashboard.getChangeDescription() != null) {
      esChangeDescription =
          ESChangeDescription.builder().updatedAt(updatedTimestamp).updatedBy(dashboard.getUpdatedBy()).build();
      esChangeDescription.setFieldsAdded(dashboard.getChangeDescription().getFieldsAdded());
      esChangeDescription.setFieldsDeleted(dashboard.getChangeDescription().getFieldsDeleted());
      esChangeDescription.setFieldsUpdated(dashboard.getChangeDescription().getFieldsUpdated());
    } else if (responseCode == Response.Status.CREATED.getStatusCode()) {
      esChangeDescription =
          ESChangeDescription.builder().updatedAt(updatedTimestamp).updatedBy(dashboard.getUpdatedBy()).build();
    }
    dashboardESIndexBuilder.changeDescriptions(esChangeDescription != null ? List.of(esChangeDescription) : null);
    return dashboardESIndexBuilder;
  }
}

@EqualsAndHashCode(callSuper = true)
@Getter
@SuperBuilder(builderMethodName = "internalBuilder")
@Value
@JsonInclude(JsonInclude.Include.NON_NULL)
class PipelineESIndex extends ElasticSearchIndex {
  @JsonProperty("pipeine_id")
  String pipelineId;

  @JsonProperty("task_names")
  List<String> taskNames;

  @JsonProperty("task_descriptions")
  List<String> taskDescriptions;

  public static PipelineESIndexBuilder builder(Pipeline pipeline, int responseCode) {
    List<String> tags = new ArrayList<>();
    List<String> taskNames = new ArrayList<>();
    List<String> taskDescriptions = new ArrayList<>();
    List<ElasticSearchSuggest> suggest = new ArrayList<>();
    suggest.add(ElasticSearchSuggest.builder().input(pipeline.getFullyQualifiedName()).weight(5).build());
    suggest.add(ElasticSearchSuggest.builder().input(pipeline.getDisplayName()).weight(10).build());

    if (pipeline.getTags() != null) {
      pipeline.getTags().forEach(tag -> tags.add(tag.getTagFQN()));
    }

    for (Task task : pipeline.getTasks()) {
      taskNames.add(task.getDisplayName());
      taskDescriptions.add(task.getDescription());
    }
    Long updatedTimestamp = pipeline.getUpdatedAt().getTime();
    ParseTags parseTags = new ParseTags(tags);
    String description = pipeline.getDescription() != null ? pipeline.getDescription() : "";
    String displayName = pipeline.getDisplayName() != null ? pipeline.getDisplayName() : "";
    PipelineESIndexBuilder pipelineESIndexBuilder =
        internalBuilder()
            .pipelineId(pipeline.getId().toString())
            .name(pipeline.getDisplayName())
            .displayName(description)
            .description(displayName)
            .fqdn(pipeline.getFullyQualifiedName())
            .lastUpdatedTimestamp(updatedTimestamp)
            .taskNames(taskNames)
            .taskDescriptions(taskDescriptions)
            .entityType("pipeline")
            .suggest(suggest)
            .service(pipeline.getService().getName())
            .serviceType(pipeline.getServiceType().toString())
            .serviceCategory("pipelineService")
            .tags(parseTags.tags)
            .tier(parseTags.tierTag);

    if (pipeline.getFollowers() != null) {
      pipelineESIndexBuilder.followers(
          pipeline.getFollowers().stream().map(item -> item.getId().toString()).collect(Collectors.toList()));
    } else if (responseCode == Response.Status.CREATED.getStatusCode()) {
      pipelineESIndexBuilder.followers(Collections.emptyList());
    }

    if (pipeline.getOwner() != null) {
      pipelineESIndexBuilder.owner(pipeline.getOwner().getId().toString());
    }

    ESChangeDescription esChangeDescription = null;
    if (pipeline.getChangeDescription() != null) {
      esChangeDescription =
          ESChangeDescription.builder().updatedAt(updatedTimestamp).updatedBy(pipeline.getUpdatedBy()).build();
      esChangeDescription.setFieldsAdded(pipeline.getChangeDescription().getFieldsAdded());
      esChangeDescription.setFieldsDeleted(pipeline.getChangeDescription().getFieldsDeleted());
      esChangeDescription.setFieldsUpdated(pipeline.getChangeDescription().getFieldsUpdated());
    } else if (responseCode == Response.Status.CREATED.getStatusCode()) {
      esChangeDescription =
          ESChangeDescription.builder().updatedAt(updatedTimestamp).updatedBy(pipeline.getUpdatedBy()).build();
    }
    pipelineESIndexBuilder.changeDescriptions(esChangeDescription != null ? List.of(esChangeDescription) : null);
    return pipelineESIndexBuilder;
  }
}
