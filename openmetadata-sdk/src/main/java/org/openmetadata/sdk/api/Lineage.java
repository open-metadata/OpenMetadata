package org.openmetadata.sdk.api;

import java.util.*;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Pure Fluent API for Lineage operations.
 *
 * This provides a builder-style fluent interface for managing data lineage in OpenMetadata.
 *
 * Usage Examples:
 * <pre>
 * // Get lineage for an entity
 * var lineage = Lineage.of("table", tableId)
 *     .upstream(3)
 *     .downstream(2)
 *     .includeDeleted(false)
 *     .fetch();
 *
 * // Add lineage between entities
 * Lineage.connect()
 *     .from("table", sourceTableId)
 *     .to("dashboard", dashboardId)
 *     .withDescription("Dashboard uses data from this table")
 *     .withSqlQuery("SELECT * FROM source_table")
 *     .execute();
 *
 * // Add complex lineage with column-level mapping
 * Lineage.connect()
 *     .from("table", sourceTableId)
 *     .fromColumns("customer_id", "order_date")
 *     .to("table", targetTableId)
 *     .toColumns("cust_id", "date")
 *     .withPipeline("pipeline", pipelineId)
 *     .withDescription("ETL transformation")
 *     .execute();
 *
 * // Remove lineage
 * Lineage.disconnect()
 *     .from("table", sourceTableId)
 *     .to("dashboard", dashboardId)
 *     .confirm();
 *
 * // Export lineage
 * var csv = Lineage.export()
 *     .entity("table", fqn)
 *     .upstream(3)
 *     .downstream(2)
 *     .execute();
 * </pre>
 */
public final class Lineage {
  private static OpenMetadataClient defaultClient;

  private Lineage() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Lineage.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Lineage Builders ====================

  public static LineageQuery of(String entityType, String entityId) {
    return new LineageQuery(getClient(), entityType, entityId);
  }

  public static LineageConnector connect() {
    return new LineageConnector(getClient());
  }

  public static LineageDisconnector disconnect() {
    return new LineageDisconnector(getClient());
  }

  public static LineageExporter export() {
    return new LineageExporter(getClient());
  }

  public static LineagePathFinder path() {
    return new LineagePathFinder(getClient());
  }

  public static ImpactAnalyzer impact() {
    return new ImpactAnalyzer(getClient());
  }

  // ==================== Lineage Query ====================

  public static class LineageQuery {
    private final OpenMetadataClient client;
    private final String entityType;
    private final String entityId;
    private int upstreamDepth = 1;
    private int downstreamDepth = 1;
    private boolean includeDeleted = false;

    LineageQuery(OpenMetadataClient client, String entityType, String entityId) {
      this.client = client;
      this.entityType = entityType;
      this.entityId = entityId;
    }

    public LineageQuery upstream(int depth) {
      this.upstreamDepth = depth;
      return this;
    }

    public LineageQuery downstream(int depth) {
      this.downstreamDepth = depth;
      return this;
    }

    public LineageQuery depth(int depth) {
      this.upstreamDepth = depth;
      this.downstreamDepth = depth;
      return this;
    }

    public LineageQuery includeDeleted(boolean include) {
      this.includeDeleted = include;
      return this;
    }

    public LineageGraph fetch() {
      String result =
          client
              .lineage()
              .getEntityLineage(
                  entityType,
                  entityId,
                  String.valueOf(upstreamDepth),
                  String.valueOf(downstreamDepth));
      return new LineageGraph(result, client);
    }
  }

  // ==================== Lineage Connector ====================

  public static class LineageConnector {
    private final OpenMetadataClient client;
    private EntityRef fromEntity;
    private EntityRef toEntity;
    private final List<String> fromColumns = new ArrayList<>();
    private final List<String> toColumns = new ArrayList<>();
    private EntityRef pipelineEntity;
    private String description;
    private String sqlQuery;
    private final Map<String, Object> properties = new HashMap<>();

    LineageConnector(OpenMetadataClient client) {
      this.client = client;
    }

    public LineageConnector from(String entityType, String entityId) {
      this.fromEntity = new EntityRef(entityType, entityId);
      return this;
    }

    public LineageConnector fromColumns(String... columns) {
      this.fromColumns.addAll(Arrays.asList(columns));
      return this;
    }

    public LineageConnector to(String entityType, String entityId) {
      this.toEntity = new EntityRef(entityType, entityId);
      return this;
    }

    public LineageConnector toColumns(String... columns) {
      this.toColumns.addAll(Arrays.asList(columns));
      return this;
    }

    public LineageConnector withPipeline(String pipelineType, String pipelineId) {
      this.pipelineEntity = new EntityRef(pipelineType, pipelineId);
      return this;
    }

    public LineageConnector withDescription(String description) {
      this.description = description;
      return this;
    }

    public LineageConnector withSqlQuery(String sqlQuery) {
      this.sqlQuery = sqlQuery;
      return this;
    }

    public LineageConnector withProperty(String key, Object value) {
      this.properties.put(key, value);
      return this;
    }

    public LineageEdge execute() {
      Map<String, Object> lineageRequest = buildLineageRequest();
      String result = client.lineage().addLineage(lineageRequest);
      return new LineageEdge(result);
    }

    private Map<String, Object> buildLineageRequest() {
      Map<String, Object> request = new HashMap<>();
      Map<String, Object> edge = new HashMap<>();

      edge.put("fromEntity", fromEntity.toMap());
      edge.put("toEntity", toEntity.toMap());

      if (description != null) {
        edge.put("description", description);
      }

      // Build lineageDetails when column mappings, pipeline, or sqlQuery are present
      boolean hasDetails =
          !fromColumns.isEmpty()
              || !toColumns.isEmpty()
              || pipelineEntity != null
              || sqlQuery != null;

      if (hasDetails) {
        Map<String, Object> lineageDetails = new HashMap<>();

        if (!toColumns.isEmpty()) {
          List<Map<String, Object>> columnsLineage = new ArrayList<>();
          for (String toCol : toColumns) {
            Map<String, Object> mapping = new HashMap<>();
            mapping.put("fromColumns", new ArrayList<>(fromColumns));
            mapping.put("toColumn", toCol);
            columnsLineage.add(mapping);
          }
          lineageDetails.put("columnsLineage", columnsLineage);
        }

        if (pipelineEntity != null) {
          lineageDetails.put("pipeline", pipelineEntity.toMap());
        }

        if (sqlQuery != null) {
          lineageDetails.put("sqlQuery", sqlQuery);
        }

        edge.put("lineageDetails", lineageDetails);
      }

      if (!properties.isEmpty()) {
        edge.put("properties", properties);
      }

      request.put("edge", edge);
      return request;
    }
  }

  // ==================== Lineage Disconnector ====================

  public static class LineageDisconnector {
    private final OpenMetadataClient client;
    private String fromEntity;
    private String toEntity;

    LineageDisconnector(OpenMetadataClient client) {
      this.client = client;
    }

    public LineageDisconnector from(String entityType, String entityId) {
      this.fromEntity = entityType + ":" + entityId;
      return this;
    }

    public LineageDisconnector to(String entityType, String entityId) {
      this.toEntity = entityType + ":" + entityId;
      return this;
    }

    public void confirm() {
      client.lineage().deleteLineage(fromEntity, toEntity);
    }
  }

  // ==================== Lineage Exporter ====================

  public static class LineageExporter {
    private final OpenMetadataClient client;
    private String entityType;
    private String fqn;
    private int upstreamDepth = 1;
    private int downstreamDepth = 1;

    LineageExporter(OpenMetadataClient client) {
      this.client = client;
    }

    public LineageExporter entity(String entityType, String fqn) {
      this.entityType = entityType;
      this.fqn = fqn;
      return this;
    }

    public LineageExporter upstream(int depth) {
      this.upstreamDepth = depth;
      return this;
    }

    public LineageExporter downstream(int depth) {
      this.downstreamDepth = depth;
      return this;
    }

    public String execute() {
      return client
          .lineage()
          .exportLineage(
              fqn, entityType, String.valueOf(upstreamDepth), String.valueOf(downstreamDepth));
    }
  }

  // ==================== Lineage Path Finder ====================

  public static class LineagePathFinder {
    private final OpenMetadataClient client;
    private EntityRef fromEntity;
    private EntityRef toEntity;
    private int maxDepth = 10;

    LineagePathFinder(OpenMetadataClient client) {
      this.client = client;
    }

    public LineagePathFinder from(String entityType, String entityId) {
      this.fromEntity = new EntityRef(entityType, entityId);
      return this;
    }

    public LineagePathFinder to(String entityType, String entityId) {
      this.toEntity = new EntityRef(entityType, entityId);
      return this;
    }

    public LineagePathFinder maxDepth(int depth) {
      this.maxDepth = depth;
      return this;
    }

    public LineagePath findShortest() {
      // Implementation would find shortest path
      return new LineagePath();
    }

    public List<LineagePath> findAll() {
      // Implementation would find all paths
      return new ArrayList<>();
    }
  }

  // ==================== Impact Analyzer ====================

  public static class ImpactAnalyzer {
    private final OpenMetadataClient client;
    private String entityType;
    private String entityId;
    private Direction direction = Direction.DOWNSTREAM;
    private int depth = 1;

    ImpactAnalyzer(OpenMetadataClient client) {
      this.client = client;
    }

    public ImpactAnalyzer of(String entityType, String entityId) {
      this.entityType = entityType;
      this.entityId = entityId;
      return this;
    }

    public ImpactAnalyzer upstream() {
      this.direction = Direction.UPSTREAM;
      return this;
    }

    public ImpactAnalyzer downstream() {
      this.direction = Direction.DOWNSTREAM;
      return this;
    }

    public ImpactAnalyzer depth(int depth) {
      this.depth = depth;
      return this;
    }

    public ImpactAnalysis analyze() {
      String result =
          client
              .lineage()
              .getEntityLineage(
                  entityType,
                  entityId,
                  direction == Direction.UPSTREAM ? String.valueOf(depth) : "0",
                  direction == Direction.DOWNSTREAM ? String.valueOf(depth) : "0");
      return new ImpactAnalysis(result);
    }
  }

  // ==================== Result Classes ====================

  public static class LineageGraph {
    private final String rawData;
    private final OpenMetadataClient client;

    LineageGraph(String rawData, OpenMetadataClient client) {
      this.rawData = rawData;
      this.client = client;
    }

    public String getRaw() {
      return rawData;
    }

    public List<LineageNode> getNodes() {
      // Parse and return nodes
      return new ArrayList<>();
    }

    public List<LineageEdge> getEdges() {
      // Parse and return edges
      return new ArrayList<>();
    }

    public LineageNode getRootNode() {
      // Return the root node
      return null;
    }

    public List<LineageNode> getUpstreamNodes() {
      // Return upstream nodes
      return new ArrayList<>();
    }

    public List<LineageNode> getDownstreamNodes() {
      // Return downstream nodes
      return new ArrayList<>();
    }
  }

  public static class LineageNode {
    private final String entityType;
    private final String entityId;
    private final String name;
    private final Map<String, Object> properties;

    LineageNode(String entityType, String entityId, String name, Map<String, Object> properties) {
      this.entityType = entityType;
      this.entityId = entityId;
      this.name = name;
      this.properties = properties;
    }

    public String getEntityType() {
      return entityType;
    }

    public String getEntityId() {
      return entityId;
    }

    public String getName() {
      return name;
    }

    public Object getProperty(String key) {
      return properties.get(key);
    }
  }

  public static class LineageEdge {
    private final String rawData;

    LineageEdge(String rawData) {
      this.rawData = rawData;
    }

    public String getRaw() {
      return rawData;
    }

    public String getFromEntity() {
      // Parse and return
      return null;
    }

    public String getToEntity() {
      // Parse and return
      return null;
    }
  }

  public static class LineagePath {
    private final List<LineageNode> nodes = new ArrayList<>();

    public List<LineageNode> getNodes() {
      return nodes;
    }

    public int getLength() {
      return nodes.size();
    }
  }

  public static class ImpactAnalysis {
    private final String rawData;

    ImpactAnalysis(String rawData) {
      this.rawData = rawData;
    }

    public List<ImpactedEntity> getImpactedEntities() {
      // Parse and return impacted entities
      return new ArrayList<>();
    }

    public int getTotalImpactCount() {
      return getImpactedEntities().size();
    }

    public Map<String, Integer> getImpactByType() {
      // Group impacted entities by type
      return new HashMap<>();
    }
  }

  public static class ImpactedEntity {
    private final String entityType;
    private final String entityId;
    private final String name;
    private final int distance;

    ImpactedEntity(String entityType, String entityId, String name, int distance) {
      this.entityType = entityType;
      this.entityId = entityId;
      this.name = name;
      this.distance = distance;
    }

    public String getEntityType() {
      return entityType;
    }

    public String getEntityId() {
      return entityId;
    }

    public String getName() {
      return name;
    }

    public int getDistance() {
      return distance;
    }
  }

  // ==================== Helper Classes ====================

  private static class EntityRef {
    private final String type;
    private final String id;

    EntityRef(String type, String id) {
      this.type = type;
      this.id = id;
    }

    Map<String, Object> toMap() {
      Map<String, Object> map = new HashMap<>();
      map.put("type", type);
      map.put("id", id);
      return map;
    }
  }

  // ==================== Enums ====================

  public enum Direction {
    UPSTREAM,
    DOWNSTREAM,
    BOTH
  }
}
