package org.openmetadata.catalog.elasticsearch;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Getter;
import lombok.experimental.SuperBuilder;
import org.checkerframework.checker.units.qual.A;
import org.openmetadata.catalog.entity.data.Chart;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.entity.data.DbtModel;
import org.openmetadata.catalog.entity.data.Pipeline;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.data.Topic;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.type.Task;

import java.io.IOException;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;
import java.util.stream.Collectors;

public  final class ElasticSearchIndexDefinition {

  private ElasticSearchIndexDefinition() {
  }

  public enum ElasticSearchIndexType {
    TABLE_SEARCH_INDEX("table_search_index", "elasticsearch/table_index_mapping.json"),
    TOPIC_SEARCH_INDEX("topic_search_index", "elasticsearch/topic_index_mapping.json"),
    DASHBOARD_SEARCH_INDEX("dashboard_search_index", "elasticsearch/dashboard_index_mapping.json"),
    PIPELINE_SEARCH_INDEX("pipeline_search_index", "elasticsearch/pipeline_index_mapping.json"),
    DBT_MODEL_SEARCH_INDEX("dbt_model_search_index", "elasticsearch/dbt_index_mapping.json");

    public final String indexName;
    public final String indexMappingFile;

    ElasticSearchIndexType(String indexName, String indexMappingFile) {
      this.indexName = indexName;
      this.indexMappingFile = indexMappingFile;
    }
  }

  public static String getIndexMapping(ElasticSearchIndexType elasticSearchIndexType)
      throws URISyntaxException, IOException {
    URL resource = ElasticSearchIndexDefinition.class
        .getClassLoader().getResource(elasticSearchIndexType.indexMappingFile);
    Path path = Paths.get(resource.toURI());
    return new String(Files.readAllBytes(path));
  }

}

@SuperBuilder
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

  public ElasticSearchIndex tags(List<String> tags) {
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
        this.tier = tierTag;
      }
      this.tags = tagsList;
    } else {
      this.tags = tags;
    }
    return this;
  }

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
@SuperBuilder(builderMethodName = "internalBuilder")
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


  public static TableESIndexBuilder builder(Table table) {
    String tableId = table.getId().toString();
    String tableName = table.getName();
    String description = table.getDescription();
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
    TableESIndexBuilder tableESIndexBuilder =  internalBuilder().tableId(tableId)
        .name(tableName)
        .displayName(tableName)
        .description(description)
        .fqdn(table.getFullyQualifiedName())
        .suggest(suggest)
        .entityType("table")
        .serviceCategory("databaseService")
        .columnNames(columnNames)
        .columnDescriptions(columnDescriptions)
        .tableType(table.getTableType().toString())
        .tags(tags);

    if (table.getDatabase() != null) {
       tableESIndexBuilder.database(table.getDatabase().getName());
    }

    if (table.getUsageSummary() != null) {
        tableESIndexBuilder.weeklyStats(table.getUsageSummary().getWeeklyStats().getCount())
          .weeklyPercentileRank(table.getUsageSummary().getWeeklyStats().getPercentileRank().intValue())
          .dailyStats(table.getUsageSummary().getDailyStats().getCount())
          .dailyPercentileRank(table.getUsageSummary().getDailyStats().getPercentileRank().intValue())
          .monthlyStats(table.getUsageSummary().getMonthlyStats().getCount())
          .monthlyPercentileRank(table.getUsageSummary().getMonthlyStats().getPercentileRank().intValue());
    }
    if (table.getFollowers() != null) {
       tableESIndexBuilder.followers(table.getFollowers().stream().map(item ->
           item.getId().toString()).collect(Collectors.toList()));
    }
    if (table.getOwner() != null) {
        tableESIndexBuilder.owner(table.getOwner().getId().toString());
    }
    return tableESIndexBuilder;
  }


  private static List<FlattenColumn> parseColumns(List<Column> columns, List<FlattenColumn> flattenColumns,
                                           String parentColumn) {
    Optional<String> optParentColumn = Optional.ofNullable(parentColumn).filter(Predicate.not(String::isEmpty));
    List<String> tags = new ArrayList<>();
    for (Column col: columns) {
      String columnName = col.getName();
      if (optParentColumn.isPresent()) {
        columnName = optParentColumn.get() + "." + columnName;
      }
      if (col.getTags() != null) {
        tags = col.getTags().stream().map(TagLabel::getTagFQN).collect(Collectors.toList());
      }

      FlattenColumn flattenColumn = FlattenColumn.builder()
          .name(columnName)
          .description(col.getDescription()).build();

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


@Getter
@SuperBuilder(builderMethodName = "internalBuilder")
class TopicESIndex extends ElasticSearchIndex {
  @JsonProperty("topic_id")
  String topicId;

  public static TopicESIndexBuilder builder(Topic topic) {
    List<String> tags = new ArrayList<>();
    List<ElasticSearchSuggest> suggest = new ArrayList<>();
    suggest.add(ElasticSearchSuggest.builder().input(topic.getFullyQualifiedName()).weight(5).build());
    suggest.add(ElasticSearchSuggest.builder().input(topic.getDisplayName()).weight(10).build());

    if (topic.getTags() != null) {
      topic.getTags().forEach(tag -> tags.add(tag.getTagFQN()));
    }

    TopicESIndexBuilder topicESIndexBuilder =  internalBuilder().topicId(topic.getId().toString())
        .name(topic.getDisplayName())
        .displayName(topic.getDisplayName())
        .description(topic.getDescription())
        .fqdn(topic.getFullyQualifiedName())
        .suggest(suggest)
        .service(topic.getService().getName())
        .serviceType(topic.getService().getType())
        .serviceCategory("messagingService")
        .entityType("topic")
        .tags(tags);

    if (topic.getFollowers() != null) {
      topicESIndexBuilder.followers(topic.getFollowers().stream().map(item ->
          item.getId().toString()).collect(Collectors.toList()));
    }
    if (topic.getOwner() != null) {
      topicESIndexBuilder.owner(topic.getOwner().getId().toString());
    }
    return topicESIndexBuilder;
  }
}


@Getter
@SuperBuilder(builderMethodName = "internalBuilder")
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

  public static DashboardESIndexBuilder builder(Dashboard dashboard) {
    List<String> tags = new ArrayList<>();
    List<String> chartNames = new ArrayList<>();
    List<String> chartDescriptions = new ArrayList<>();
    List<ElasticSearchSuggest> suggest = new ArrayList<>();
    suggest.add(ElasticSearchSuggest.builder().input(dashboard.getFullyQualifiedName()).weight(5).build());
    suggest.add(ElasticSearchSuggest.builder().input(dashboard.getDisplayName()).weight(10).build());

    if (dashboard.getTags() != null) {
      dashboard.getTags().forEach(tag -> tags.add(tag.getTagFQN()));
    }

    for (EntityReference chart: dashboard.getCharts()) {
      chartNames.add(chart.getDisplayName());
      chartDescriptions.add(chart.getDescription());
    }

    DashboardESIndexBuilder dashboardESIndexBuilder =  internalBuilder().dashboardId(dashboard.getId().toString())
        .name(dashboard.getDisplayName())
        .displayName(dashboard.getDisplayName())
        .description(dashboard.getDescription())
        .fqdn(dashboard.getFullyQualifiedName())
        .chartNames(chartNames)
        .chartDescriptions(chartDescriptions)
        .entityType("dashboard")
        .suggest(suggest)
        .service(dashboard.getService().getName())
        .serviceType(dashboard.getService().getType())
        .serviceCategory("dashboardService")
        .followers(dashboard.getFollowers().stream().map(item -> item.getId().toString()).collect(Collectors.toList()))
        .owner(dashboard.getOwner().getId().toString())
        .tags(tags);

    if (dashboard.getUsageSummary() != null) {
      dashboardESIndexBuilder.weeklyStats(dashboard.getUsageSummary().getWeeklyStats().getCount())
          .weeklyPercentileRank(dashboard.getUsageSummary().getWeeklyStats().getPercentileRank().intValue())
          .dailyStats(dashboard.getUsageSummary().getDailyStats().getCount())
          .dailyPercentileRank(dashboard.getUsageSummary().getDailyStats().getPercentileRank().intValue())
          .monthlyStats(dashboard.getUsageSummary().getMonthlyStats().getCount())
          .monthlyPercentileRank(dashboard.getUsageSummary().getMonthlyStats().getPercentileRank().intValue());
    }
    if (dashboard.getFollowers() != null) {
      dashboardESIndexBuilder.followers(dashboard.getFollowers().stream().map(item ->
          item.getId().toString()).collect(Collectors.toList()));
    }
    if (dashboard.getOwner() != null) {
      dashboardESIndexBuilder.owner(dashboard.getOwner().getId().toString());
    }

    return dashboardESIndexBuilder;
  }
}


@Getter
@SuperBuilder(builderMethodName = "internalBuilder")
class PipelineESIndex extends ElasticSearchIndex {
  @JsonProperty("pipeine_id")
  String pipelineId;
  @JsonProperty("task_names")
  List<String> taskNames;
  @JsonProperty("task_descriptions")
  List<String> taskDescriptions;

  public static PipelineESIndexBuilder builder(Pipeline pipeline) {
    List<String> tags = new ArrayList<>();
    List<String> taskNames = new ArrayList<>();
    List<String> taskDescriptions = new ArrayList<>();
    List<ElasticSearchSuggest> suggest = new ArrayList<>();
    suggest.add(ElasticSearchSuggest.builder().input(pipeline.getFullyQualifiedName()).weight(5).build());
    suggest.add(ElasticSearchSuggest.builder().input(pipeline.getDisplayName()).weight(10).build());

    if (pipeline.getTags() != null) {
      pipeline.getTags().forEach(tag -> tags.add(tag.getTagFQN()));
    }

    for (Task task: pipeline.getTasks()) {
      taskNames.add(task.getDisplayName());
      taskDescriptions.add(task.getDescription());
    }

    PipelineESIndexBuilder pipelineESIndexBuilder = internalBuilder().pipelineId(pipeline.getId().toString())
        .name(pipeline.getDisplayName())
        .displayName(pipeline.getDisplayName())
        .description(pipeline.getDescription())
        .fqdn(pipeline.getFullyQualifiedName())
        .taskNames(taskNames)
        .taskDescriptions(taskDescriptions)
        .entityType("pipeline")
        .suggest(suggest)
        .service(pipeline.getService().getName())
        .serviceType(pipeline.getService().getType())
        .serviceCategory("pipelineService")
        .tags(tags);

    if (pipeline.getFollowers() != null) {
        pipelineESIndexBuilder.followers(pipeline.getFollowers().stream().map(item ->
                item.getId().toString()).collect(Collectors.toList()));
    }
    if (pipeline.getOwner() != null) {
      pipelineESIndexBuilder.owner(pipeline.getOwner().getId().toString());
    }

    return pipelineESIndexBuilder;
  }
}


@Getter
@SuperBuilder(builderMethodName = "internalBuilder")
class DbtModelESIndex extends ElasticSearchIndex {
  @JsonProperty("dbt_model_id")
  String dbtModelId;
  @JsonProperty("column_names")
  List<String> columnNames;
  @JsonProperty("column_descriptions")
  List<String> columnDescriptions;
  String database;
  @JsonProperty("node_type")
  String nodeType;

  public static DbtModelESIndexBuilder builder(DbtModel dbtModel) {
    List<String> tags = new ArrayList<>();
    List<String> columnNames = new ArrayList<>();
    List<String> columnDescriptions = new ArrayList<>();
    List<ElasticSearchSuggest> suggest = new ArrayList<>();
    suggest.add(ElasticSearchSuggest.builder().input(dbtModel.getFullyQualifiedName()).weight(5).build());
    suggest.add(ElasticSearchSuggest.builder().input(dbtModel.getDisplayName()).weight(10).build());

    if (dbtModel.getTags() != null) {
      dbtModel.getTags().forEach(tag -> tags.add(tag.getTagFQN()));
    }

    for (Column column: dbtModel.getColumns()) {
      columnNames.add(column.getName());
      columnDescriptions.add(column.getDescription());
    }

    DbtModelESIndexBuilder dbtModelESIndexBuilder =  internalBuilder().dbtModelId(dbtModel.getId().toString())
        .name(dbtModel.getName())
        .displayName(dbtModel.getName())
        .description(dbtModel.getDescription())
        .fqdn(dbtModel.getFullyQualifiedName())
        .columnNames(columnNames)
        .columnDescriptions(columnDescriptions)
        .entityType("dbtmodel")
        .suggest(suggest)
        .serviceCategory("pipelineService")
        .nodeType(dbtModel.getDbtNodeType().toString())
        .database(dbtModel.getDatabase().getName())
        .tags(tags);

    if (dbtModel.getFollowers() != null) {
      dbtModelESIndexBuilder.followers(dbtModel.getFollowers().stream().map(item ->
              item.getId().toString()).collect(Collectors.toList()));
    }
    if (dbtModel.getOwner() != null) {
       dbtModelESIndexBuilder.owner(dbtModel.getOwner().getId().toString());
    }
    return dbtModelESIndexBuilder;
  }
}


