package org.openmetadata.service.rdf;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * Utility methods for RDF operations
 */
public final class RdfUtils {

  private static final Set<String> PROV_ACTIVITY_TYPES =
      Set.of(
          "pipeline",
          "ingestionpipeline",
          "storedprocedure",
          "dbtpipeline",
          "workflow",
          "pipelinerun");

  private static final Set<String> PROV_AGENT_TYPES = Set.of("user", "team", "bot", "role");

  private static final Set<String> PROV_ENTITY_TYPES =
      Set.of(
          "table",
          "database",
          "databaseschema",
          "dashboard",
          "chart",
          "topic",
          "mlmodel",
          "container",
          "report",
          "searchindex",
          "apicollection",
          "apiendpoint",
          "datamodel",
          "dashboarddatamodel",
          "metric",
          "directory",
          "file",
          "worksheet",
          "spreadsheet",
          "glossaryterm",
          "tag",
          "dataproduct",
          "domain");

  private RdfUtils() {}

  /**
   * Maps an entity type to its PROV-O class (Entity, Activity, or Agent).
   * Returns null when the entity type doesn't fit cleanly into the PROV-O model
   * (e.g. service definitions, classifications, policies).
   */
  public static String getProvType(String entityType) {
    if (entityType == null) {
      return null;
    }
    String key = entityType.toLowerCase();
    if (PROV_ACTIVITY_TYPES.contains(key)) {
      return "prov:Activity";
    }
    if (PROV_AGENT_TYPES.contains(key)) {
      return "prov:Agent";
    }
    if (PROV_ENTITY_TYPES.contains(key)) {
      return "prov:Entity";
    }
    return null;
  }

  public static String getRdfType(String entityType) {
    return switch (entityType.toLowerCase()) {
      case "table" -> "dcat:Dataset";
      case "database" -> "dcat:Catalog";
      case "dashboard" -> "dcat:DataService";
      case "pipeline" -> "prov:Activity";
      case "user" -> "foaf:Person";
      case "team" -> "foaf:Group";
      case "glossaryterm", "tag" -> "skos:Concept";
      case "classification", "glossary" -> "skos:ConceptScheme";
      case "databaseservice",
          "dashboardservice",
          "messagingservice",
          "pipelineservice",
          "mlmodelservice",
          "storageservice",
          "searchservice",
          "metadataservice",
          "apiservice",
          "reportingservice",
          "qualityservice",
          "observabilityservice",
          "driveservice" -> "dcat:DataService";
      case "role" -> "foaf:Group";
      case "bot" -> "foaf:Agent";
      case "policy" -> "om:Policy";
      case "dataproduct" -> "dprod:DataProduct"; // W3C Data Product vocabulary
      case "domain" -> "skos:Collection"; // Organizational grouping
      case "persona" -> "om:Persona";
      case "llmmodel" -> "om:LLMModel";
      case "aiapplication" -> "om:AIApplication";
      case "mcpserver" -> "om:McpServer";
      case "agentexecution" -> "om:AgentExecution";
      case "mcpexecution" -> "om:McpExecution";
      case "prompttemplate" -> "om:PromptTemplate";
      case "workflow", "workflowdefinition" -> "om:Workflow";
      case "workflowinstance" -> "om:WorkflowInstance";
      case "automation" -> "om:Automation";
      default -> "om:" + entityType.substring(0, 1).toUpperCase() + entityType.substring(1);
    };
  }

  /**
   * Mints a stable, FQN-derived URI for a Column resource. Columns are sub-objects of a Table and
   * have no UUID, so the FQN is the only universal identifier. The same scheme is used by the
   * Table-side mapping (Table om:hasColumn) and by column-level lineage (om:fromColumn /
   * om:toColumn) so that SPARQL traversal across both sides resolves to the same resource.
   */
  public static String columnUri(String baseUri, String columnFqn) {
    if (columnFqn == null || columnFqn.isEmpty()) {
      return null;
    }
    return baseUri + "entity/column/" + URLEncoder.encode(columnFqn, StandardCharsets.UTF_8);
  }
}
