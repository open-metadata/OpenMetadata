package org.openmetadata.service.rdf.translator;

import com.fasterxml.jackson.databind.JsonNode;
import org.apache.jena.datatypes.xsd.XSDDatatype;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.RDF;

/**
 * Emits {@code prov:Activity} resources for OpenMetadata pipeline runs.
 *
 * <p>OpenMetadata stores the latest run of a pipeline under {@code Pipeline.pipelineStatus}. We
 * surface that as a navigable PROV-O activity tied to the pipeline (as the agent associated
 * with the activity) and to the input/output datasets via {@code prov:used} /
 * {@code prov:generated}, so SPARQL can answer "who ran what at when, against which datasets,
 * with what outcome."
 */
public final class RdfActivityMapper {

  private static final String OM_NS = "https://open-metadata.org/ontology/";
  private static final String PROV_NS = "http://www.w3.org/ns/prov#";

  private RdfActivityMapper() {}

  static void emitPipelineActivity(
      JsonNode pipelineStatus,
      String pipelineFqn,
      Resource pipelineResource,
      String baseUri,
      Model model) {
    if (pipelineStatus == null || pipelineStatus.isNull() || !pipelineStatus.isObject()) {
      return;
    }
    if (!pipelineStatus.has("timestamp") || pipelineStatus.get("timestamp").isNull()) {
      // PROV activity is meaningless without a startedAtTime equivalent.
      return;
    }
    long startMillis = pipelineStatus.get("timestamp").asLong();
    String activityUri = activityUri(pipelineResource, pipelineFqn, startMillis);
    Resource activity = model.createResource(activityUri);
    activity.addProperty(RDF.type, model.createResource(PROV_NS + "Activity"));
    activity.addProperty(RDF.type, model.createResource(OM_NS + "PipelineExecution"));

    String startedAt = java.time.Instant.ofEpochMilli(startMillis).toString();
    activity.addProperty(
        model.createProperty(PROV_NS, "startedAtTime"),
        model.createTypedLiteral(startedAt, XSDDatatype.XSDdateTime));
    if (pipelineStatus.has("endTime") && pipelineStatus.get("endTime").isNumber()) {
      String endedAt =
          java.time.Instant.ofEpochMilli(pipelineStatus.get("endTime").asLong()).toString();
      activity.addProperty(
          model.createProperty(PROV_NS, "endedAtTime"),
          model.createTypedLiteral(endedAt, XSDDatatype.XSDdateTime));
    }

    if (pipelineStatus.has("executionStatus") && !pipelineStatus.get("executionStatus").isNull()) {
      activity.addProperty(
          model.createProperty(OM_NS, "executionStatus"),
          pipelineStatus.get("executionStatus").asText());
    }
    if (pipelineStatus.has("executionId") && !pipelineStatus.get("executionId").isNull()) {
      activity.addProperty(
          model.createProperty(OM_NS, "executionId"), pipelineStatus.get("executionId").asText());
    }

    // PROV-O: prov:wasInformedBy is an Activity → Activity relation. The pipeline run "was
    // informed by" its pipeline definition (the template Activity). Previously this used
    // prov:wasGeneratedBy, which has domain prov:Entity and range prov:Activity — inverted.
    activity.addProperty(model.createProperty(PROV_NS, "wasInformedBy"), pipelineResource);
    pipelineResource.addProperty(model.createProperty(OM_NS, "hasExecution"), activity);

    addAgent(activity, pipelineStatus.get("executedBy"), baseUri, model);
    addUsedDatasets(activity, pipelineStatus.get("inputs"), "datasetFQN", "used", baseUri, model);
    addUsedDatasets(
        activity, pipelineStatus.get("outputs"), "datasetFQN", "generated", baseUri, model);
  }

  private static void addAgent(
      Resource activity, JsonNode executedBy, String baseUri, Model model) {
    if (executedBy == null || executedBy.isNull() || !executedBy.has("id")) {
      return;
    }
    String type =
        executedBy.has("type") && !executedBy.get("type").isNull()
            ? executedBy.get("type").asText()
            : "user";
    // Always mint agent IRIs under the deployment's entity namespace, never the ontology
    // namespace. JsonLdTranslator/RdfRepository wire the `om:` prefix to the *ontology* URI
    // (https://open-metadata.org/ontology/...), so reading that prefix here would place agent
    // resources alongside class definitions and mix ontology + instance data.
    Resource agent =
        model.createResource(baseUri + "entity/" + type + "/" + executedBy.get("id").asText());
    activity.addProperty(model.createProperty(PROV_NS, "wasAssociatedWith"), agent);
  }

  private static void addUsedDatasets(
      Resource activity,
      JsonNode datasets,
      String fqnField,
      String predicate,
      String baseUri,
      Model model) {
    if (datasets == null || !datasets.isArray()) {
      return;
    }
    Property prop = model.createProperty(PROV_NS, predicate);
    for (JsonNode item : datasets) {
      if (!item.isObject() || !item.has(fqnField) || item.get(fqnField).isNull()) {
        continue;
      }
      String fqn = item.get(fqnField).asText();
      // Datasets in Pipeline runs are referenced by FQN (no UUID at this layer); mint a stable
      // table URI from the FQN. The triplestore may already contain the table at a UUID-based
      // URI; both will participate in queries via the om:fullyQualifiedName literal.
      String datasetUri =
          baseUri
              + "entity/datasetByFqn/"
              + java.net.URLEncoder.encode(fqn, java.nio.charset.StandardCharsets.UTF_8);
      Resource dataset = model.createResource(datasetUri);
      dataset.addProperty(model.createProperty(OM_NS, "fullyQualifiedName"), fqn);
      activity.addProperty(prop, dataset);
    }
  }

  private static String activityUri(
      Resource pipelineResource, String pipelineFqn, long startMillis) {
    String suffix = pipelineFqn != null ? pipelineFqn : pipelineResource.getURI();
    int hash = (suffix + ":" + startMillis).hashCode();
    return pipelineResource.getURI() + "/run/" + Integer.toHexString(hash);
  }
}
