package org.openmetadata.service.rdf;

import java.util.Set;

/**
 * Utility methods for RDF operations
 */
public class RdfUtils {

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

  private RdfUtils() {
    // Private constructor for utility class
  }

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
      default -> "om:" + entityType.substring(0, 1).toUpperCase() + entityType.substring(1);
    };
  }
}
