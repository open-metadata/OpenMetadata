package org.openmetadata.service.rdf;

/**
 * Utility methods for RDF operations
 */
public class RdfUtils {

  private RdfUtils() {
    // Private constructor for utility class
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
