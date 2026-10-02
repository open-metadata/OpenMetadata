package org.openmetadata.service.lineage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.CompactLineage;
import org.openmetadata.schema.api.lineage.CompactLineageEdge;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.TempLineageTable;

/**
 * Slims a repository {@link EntityLineage} to identity and relationship info. The raw graph is
 * verbose (full SQL, column-level mappings, node descriptions) and can reach hundreds of KB for a
 * couple of nodes; node details are folded into edge endpoints, and column lineage and SQL are
 * carried only when asked for.
 *
 * <p>Generated list fields default to empty lists, which serialize as {@code []}. Every list is set
 * explicitly here, to {@code null} when absent, so an absent field stays out of the response.
 */
@Slf4j
public final class CompactLineageSlimmer {

  private static final String RELATIONSHIP_SQL = "sql";

  /** What an edge should carry. */
  public record EdgeOptions(boolean includeColumnLineage, boolean includeSql) {}

  private CompactLineageSlimmer() {}

  public static CompactLineage toSlim(EntityLineage lineage, EdgeOptions options) {
    return toSlim(lineage, options, pipeline -> true);
  }

  public static CompactLineage toSlim(
      EntityLineage lineage, EdgeOptions options, Predicate<EntityReference> pipelineVisible) {
    Map<UUID, EntityReference> nodeIndex = buildNodeIndex(lineage);
    EntityReference root = lineage.getEntity();
    return new CompactLineage()
        .withRoot(refFqn(root))
        .withRootId(root != null && root.getId() != null ? root.getId().toString() : null)
        .withRootType(refType(root))
        .withUpstream(slimEdges(lineage.getUpstreamEdges(), nodeIndex, options, pipelineVisible))
        .withDownstream(
            slimEdges(lineage.getDownstreamEdges(), nodeIndex, options, pipelineVisible))
        .withOversizedEdges(null);
  }

  private static Map<UUID, EntityReference> buildNodeIndex(EntityLineage lineage) {
    Map<UUID, EntityReference> index = new HashMap<>();
    if (lineage.getEntity() != null) {
      index.put(lineage.getEntity().getId(), lineage.getEntity());
    }
    if (!nullOrEmpty(lineage.getNodes())) {
      lineage.getNodes().forEach(node -> index.put(node.getId(), node));
    }
    return index;
  }

  private static List<CompactLineageEdge> slimEdges(
      List<Edge> edges,
      Map<UUID, EntityReference> nodeIndex,
      EdgeOptions options,
      Predicate<EntityReference> pipelineVisible) {
    // The repository dedups nodes but not edges: a node reachable via multiple paths has its
    // upstream/downstream edges re-added on each recursion. Identical slim edges carry no extra
    // information, so collapse them with a LinkedHashSet (value equality), preserving order.
    Set<CompactLineageEdge> deduped = new LinkedHashSet<>();
    if (!nullOrEmpty(edges)) {
      edges.forEach(edge -> deduped.add(buildSlimEdge(edge, nodeIndex, options, pipelineVisible)));
    }
    return new ArrayList<>(deduped);
  }

  private static CompactLineageEdge buildSlimEdge(
      Edge edge,
      Map<UUID, EntityReference> nodeIndex,
      EdgeOptions options,
      Predicate<EntityReference> pipelineVisible) {
    LineageDetails details = edge.getLineageDetails();
    EntityReference pipeline = details != null ? details.getPipeline() : null;
    // A denied pipeline still gets to say that a pipeline is what connects these two assets; what
    // it does not get to say is which pipeline.
    EntityReference namedPipeline = pipelineVisible.test(pipeline) ? pipeline : null;
    return withEndpoints(edge, nodeIndex)
        .withRelationshipType(relationshipType(pipeline, namedPipeline != null))
        .withPipelineFQN(namedPipeline != null ? namedPipeline.getFullyQualifiedName() : null)
        .withPipelineDescription(namedPipeline != null ? namedPipeline.getDescription() : null)
        .withEdgeDescription(details != null ? details.getDescription() : null)
        .withSource(sourceValue(details))
        .withAssetEdges(details != null ? details.getAssetEdges() : null)
        .withSqlQuery(options.includeSql() && details != null ? details.getSqlQuery() : null)
        .withHasSql(hasSql(details))
        .withTempLineageTables(tempLineageTablesOf(details, options.includeSql()))
        .withUpdatedAt(details != null ? details.getUpdatedAt() : null)
        .withUpdatedBy(details != null ? details.getUpdatedBy() : null)
        .withColumnsLineage(columnsLineageOf(details, options.includeColumnLineage()));
  }

  /**
   * computeLineage adds every edge endpoint to nodes (or it is the root), so the index resolves both
   * ends. If that invariant ever breaks (a partial/cached graph), the endpoint fields come back null
   * and identical anonymous edges dedup-collapse - warn instead of silently emitting a linkless edge.
   */
  private static CompactLineageEdge withEndpoints(Edge edge, Map<UUID, EntityReference> nodeIndex) {
    EntityReference from = nodeIndex.get(edge.getFromEntity());
    EntityReference to = nodeIndex.get(edge.getToEntity());
    if (from == null || to == null) {
      LOG.warn(
          "Lineage edge endpoint missing from node index (from={}, to={}); emitting partial edge",
          edge.getFromEntity(),
          edge.getToEntity());
    }
    return new CompactLineageEdge()
        .withFromFQN(refFqn(from))
        .withToFQN(refFqn(to))
        .withFromName(refName(from))
        .withToName(refName(to))
        .withFromType(refType(from))
        .withToType(refType(to));
  }

  private static List<ColumnLineage> columnsLineageOf(
      LineageDetails details, boolean includeColumns) {
    List<ColumnLineage> columns = null;
    if (includeColumns && details != null && !nullOrEmpty(details.getColumnsLineage())) {
      columns = details.getColumnsLineage();
    }
    return columns;
  }

  private static String relationshipType(EntityReference pipeline, boolean named) {
    String relationship = RELATIONSHIP_SQL;
    if (pipeline != null) {
      relationship = named ? pipeline.getType() + ":" + pipeline.getName() : pipeline.getType();
    }
    return relationship;
  }

  /**
   * Temp-table hops are table <em>names</em> parsed out of the transformation, not catalog entities,
   * so there is no policy to evaluate them against. They are identifiers lifted from the SQL, so
   * they travel with the SQL rather than being returned by default.
   */
  private static List<TempLineageTable> tempLineageTablesOf(
      LineageDetails details, boolean includeSql) {
    return includeSql && details != null ? details.getTempLineageTables() : null;
  }

  private static String sourceValue(LineageDetails details) {
    return details != null && details.getSource() != null ? details.getSource().value() : null;
  }

  /**
   * Edge SQL is opt-in. On an 18-edge graph {@code sqlQuery} was ~94% of the response, so a caller
   * asking "what feeds this table?" paid for transformation SQL to learn 18 table names. When SQL is
   * not requested {@code hasSql} still says a transformation exists, so the caller can ask for it;
   * dropping it silently would hide that it was ever there.
   */
  private static Boolean hasSql(LineageDetails details) {
    return details == null || nullOrEmpty(details.getSqlQuery()) ? null : Boolean.TRUE;
  }

  private static String refFqn(EntityReference ref) {
    return ref != null ? ref.getFullyQualifiedName() : null;
  }

  private static String refType(EntityReference ref) {
    return ref != null ? ref.getType() : null;
  }

  private static String refName(EntityReference ref) {
    String name = null;
    if (ref != null) {
      name = ref.getDisplayName() != null ? ref.getDisplayName() : ref.getName();
    }
    return name;
  }
}
