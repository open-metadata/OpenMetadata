package org.openmetadata.service.rdf.translator;

import java.util.Locale;

/**
 * Single source of truth for entity-type → JSON-LD context routing. The write path
 * (RdfPropertyMapper) and the JSON-LD export path (JsonLdTranslator) previously kept two divergent
 * switches: ~30 entity types (testCase, domain, dataProduct, query, metric, …) fell through to
 * "base" on the write path while the export path routed them to their real context, so their
 * fields serialized as opaque {@code om:<field> "…json…"} string literals — bloating every write
 * request and defeating SPARQL over those types. Both paths must consume THIS mapping.
 */
public final class RdfContextRegistry {

  private RdfContextRegistry() {}

  public static String contextNameFor(String entityType) {
    return switch (entityType.toLowerCase(Locale.ROOT)) {
      case "table",
          "database",
          "databaseschema",
          "storedprocedure",
          "query",
          "dashboard",
          "dashboarddatamodel",
          "chart",
          "report",
          "pipeline",
          "topic",
          "mlmodel",
          "container",
          "metric",
          "searchindex",
          "apicollection",
          "apiendpoint",
          "directory",
          "file",
          "spreadsheet",
          "worksheet" -> "dataAsset-complete";
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
          "driveservice" -> "service";
      case "user", "team", "role", "bot", "policy" -> "team";
      case "thread", "post" -> "thread";
      case "glossary",
          "glossaryterm",
          "classification",
          "tag",
          "datacontract",
          "dataproduct",
          "domain",
          "persona" -> "governance";
      case "testdefinition",
          "testsuite",
          "testcase",
          "testcaseresult",
          "testcaseresolutionstatus" -> "quality";
      case "ingestionpipeline",
          "eventsubscription",
          "kpi",
          "datainsightchart",
          "webanalyticevent",
          "app",
          "appmarketplacedefinition",
          "document",
          "page" -> "operations";
      case "llmmodel",
          "aiapplication",
          "mcpserver",
          "mcpexecution",
          "agentexecution",
          "prompttemplate" -> "ai";
      case "workflow",
          "workflowdefinition",
          "workflowinstance",
          "workflowinstancestate",
          "automation" -> "automation";
      default -> "base";
    };
  }
}
