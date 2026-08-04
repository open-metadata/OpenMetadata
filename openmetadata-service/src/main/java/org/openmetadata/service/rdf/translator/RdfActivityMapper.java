package org.openmetadata.service.rdf.translator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
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
    RdfJsonNode.object(pipelineStatus)
        .flatMap(
            status ->
                RdfJsonNode.field(status, "timestamp")
                    .filter(JsonNode::isNumber)
                    .map(timestamp -> new PipelineRun(status, timestamp.asLong())))
        .ifPresent(run -> emitPipelineActivity(run, pipelineFqn, pipelineResource, baseUri, model));
  }

  private static void emitPipelineActivity(
      PipelineRun run, String pipelineFqn, Resource pipelineResource, String baseUri, Model model) {
    String activityUri = activityUri(pipelineResource, pipelineFqn, run.startedAt());
    Resource activity = model.createResource(activityUri);
    activity.addProperty(RDF.type, model.createResource(PROV_NS + "Activity"));
    activity.addProperty(RDF.type, model.createResource(OM_NS + "PipelineExecution"));

    String startedAt = Instant.ofEpochMilli(run.startedAt()).toString();
    activity.addProperty(
        model.createProperty(PROV_NS, "startedAtTime"),
        model.createTypedLiteral(startedAt, XSDDatatype.XSDdateTime));
    RdfJsonNode.field(run.status(), "endTime")
        .filter(JsonNode::isNumber)
        .map(endTime -> Instant.ofEpochMilli(endTime.asLong()).toString())
        .ifPresent(
            endedAt ->
                activity.addProperty(
                    model.createProperty(PROV_NS, "endedAtTime"),
                    model.createTypedLiteral(endedAt, XSDDatatype.XSDdateTime)));
    addLiteral(activity, run.status(), "executionStatus", OM_NS, model);
    addLiteral(activity, run.status(), "executionId", OM_NS, model);

    // PROV-O: prov:wasInformedBy is an Activity → Activity relation. The pipeline run "was
    // informed by" its pipeline definition (the template Activity). Previously this used
    // prov:wasGeneratedBy, which has domain prov:Entity and range prov:Activity — inverted.
    activity.addProperty(model.createProperty(PROV_NS, "wasInformedBy"), pipelineResource);
    pipelineResource.addProperty(model.createProperty(OM_NS, "hasExecution"), activity);

    ActivityContext context = new ActivityContext(activity, baseUri, model);
    addAgent(context, run.status().get("executedBy"));
    addUsedDatasets(context, run.status().get("inputs"), "datasetFQN", "used");
    addUsedDatasets(context, run.status().get("outputs"), "datasetFQN", "generated");
  }

  private static void addLiteral(
      Resource subject, JsonNode source, String fieldName, String namespace, Model model) {
    RdfJsonNode.field(source, fieldName)
        .ifPresent(
            value ->
                subject.addProperty(model.createProperty(namespace, fieldName), value.asText()));
  }

  private static void addAgent(ActivityContext context, JsonNode executedBy) {
    RdfJsonNode.object(executedBy)
        .flatMap(
            agent ->
                RdfJsonNode.field(agent, "id")
                    .map(
                        identifier ->
                            new Agent(
                                identifier.asText(),
                                RdfJsonNode.field(agent, "type")
                                    .map(JsonNode::asText)
                                    .orElse("user"))))
        .map(
            agent ->
                context
                    .model()
                    .createResource(
                        context.baseUri() + "entity/" + agent.type() + "/" + agent.id()))
        .ifPresent(
            agent ->
                context
                    .activity()
                    .addProperty(
                        context.model().createProperty(PROV_NS, "wasAssociatedWith"), agent));
  }

  private static void addUsedDatasets(
      ActivityContext context, JsonNode datasets, String fqnField, String predicate) {
    Property property = context.model().createProperty(PROV_NS, predicate);
    RdfJsonNode.array(datasets)
        .ifPresent(
            values ->
                values.forEach(
                    item ->
                        RdfJsonNode.object(item)
                            .flatMap(value -> RdfJsonNode.field(value, fqnField))
                            .map(JsonNode::asText)
                            .ifPresent(fqn -> addDataset(context, property, fqn))));
  }

  private static void addDataset(ActivityContext context, Property predicate, String fqn) {
    String datasetUri =
        context.baseUri() + "entity/datasetByFqn/" + URLEncoder.encode(fqn, StandardCharsets.UTF_8);
    Resource dataset = context.model().createResource(datasetUri);
    dataset.addProperty(context.model().createProperty(OM_NS, "fullyQualifiedName"), fqn);
    context.activity().addProperty(predicate, dataset);
  }

  private static String activityUri(
      Resource pipelineResource, String pipelineFqn, long startMillis) {
    String suffix = nullOrEmpty(pipelineFqn) ? pipelineResource.getURI() : pipelineFqn;
    int hash = (suffix + ":" + startMillis).hashCode();
    return pipelineResource.getURI() + "/run/" + Integer.toHexString(hash);
  }

  private record PipelineRun(JsonNode status, long startedAt) {}

  private record Agent(String id, String type) {}

  private record ActivityContext(Resource activity, String baseUri, Model model) {}
}
