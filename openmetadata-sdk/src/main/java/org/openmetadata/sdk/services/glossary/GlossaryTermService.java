package org.openmetadata.sdk.services.glossary;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.GlossaryTermRelationGraph;
import org.openmetadata.schema.api.data.OntologyStudioAsset;
import org.openmetadata.schema.api.data.OntologyStudioDataGraph;
import org.openmetadata.schema.api.data.OntologyStudioSummary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.RelationshipTypeUsage;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.EntityServiceBase;

public class GlossaryTermService extends EntityServiceBase<GlossaryTerm> {
  private static final String GLOSSARY_TERM = "glossaryTerm";

  public GlossaryTermService(HttpClient httpClient) {
    super(httpClient, "/v1/glossaryTerms");
  }

  @Override
  protected Class<GlossaryTerm> getEntityClass() {
    return GlossaryTerm.class;
  }

  public GlossaryTerm create(CreateGlossaryTerm request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, GlossaryTerm.class);
  }

  /**
   * Add a typed relation from one glossary term to another (e.g. {@code broader}, {@code narrower},
   * {@code synonym}, or a custom type registered via {@link
   * org.openmetadata.sdk.services.system.SystemSettingsService#defineGlossaryRelationType}).
   *
   * @param id the source glossary term id
   * @param relation the relation to add (target term reference + relation type)
   * @return the updated source glossary term
   */
  public GlossaryTerm addRelation(UUID id, TermRelation relation) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST, basePath + "/" + id + "/relations", relation, GlossaryTerm.class);
  }

  /** Convenience overload that builds the {@link TermRelation} from ids and a relation type. */
  public GlossaryTerm addRelation(UUID fromId, UUID toId, String relationType)
      throws OpenMetadataException {
    TermRelation relation =
        new TermRelation()
            .withRelationType(relationType)
            .withTerm(new EntityReference().withId(toId).withType(GLOSSARY_TERM));
    return addRelation(fromId, relation);
  }

  /**
   * Remove a relation from one glossary term to another.
   *
   * @param id the source glossary term id
   * @param toTermId the target glossary term id
   * @param relationType the relation type to remove, or {@code null} to remove all types
   * @return the updated source glossary term
   */
  public GlossaryTerm removeRelation(UUID id, UUID toTermId, String relationType)
      throws OpenMetadataException {
    RequestOptions options =
        relationType != null
            ? RequestOptions.builder().queryParam("relationType", relationType).build()
            : null;
    return httpClient.execute(
        HttpMethod.DELETE,
        basePath + "/" + id + "/relations/" + toTermId,
        null,
        GlossaryTerm.class,
        options);
  }

  /**
   * Fetch the relation graph rooted at a glossary term.
   *
   * @param id the root glossary term id
   * @param depth traversal depth (1-5)
   * @param relationTypes relation types to include, or {@code null}/empty for all
   * @return the bounded, typed relation graph
   */
  public GlossaryTermRelationGraph relationGraph(UUID id, int depth, List<String> relationTypes)
      throws OpenMetadataException {
    return relationGraph(id, GlossaryTermRelationGraphOptions.defaults(depth, relationTypes));
  }

  /** Fetch a relation graph with explicit traversal and response bounds. */
  public GlossaryTermRelationGraph relationGraph(
      final UUID id, final GlossaryTermRelationGraphOptions graphOptions)
      throws OpenMetadataException {
    final RequestOptions requestOptions = toRequestOptions(graphOptions);
    return httpClient.execute(
        HttpMethod.GET,
        basePath + "/" + id + "/relationsGraph",
        null,
        GlossaryTermRelationGraph.class,
        requestOptions);
  }

  /** Return per-relation-type usage counts across all glossary terms. */
  public List<RelationshipTypeUsage> relationTypeUsage() throws OpenMetadataException {
    String response =
        httpClient.executeForString(HttpMethod.GET, basePath + "/relationTypes/usage", null);
    return deserialize(response, new TypeReference<List<RelationshipTypeUsage>>() {});
  }

  /** Return the bounded health and isolation summary used by Ontology Studio. */
  public OntologyStudioSummary studioSummary(String parent, int limit, int offset)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.GET,
        basePath + "/studio/summary",
        null,
        OntologyStudioSummary.class,
        studioPageOptions(parent, limit, offset));
  }

  /** Return one bounded page of term-to-asset clusters used by Ontology Studio data mode. */
  public OntologyStudioDataGraph studioData(
      String parent, int limit, int offset, int assetPreviewSize) throws OpenMetadataException {
    RequestOptions.Builder options =
        RequestOptions.builder()
            .queryParam("assetPreviewSize", String.valueOf(assetPreviewSize))
            .queryParam("limit", String.valueOf(limit))
            .queryParam("offset", String.valueOf(offset));
    if (parent != null) {
      options.queryParam("parent", parent);
    }
    return httpClient.execute(
        HttpMethod.GET,
        basePath + "/studio/data",
        null,
        OntologyStudioDataGraph.class,
        options.build());
  }

  /** Return one bounded page of detailed assets for a term card. */
  public ResultList<OntologyStudioAsset> studioAssets(UUID id, int limit, int offset)
      throws OpenMetadataException {
    String response =
        httpClient.executeForString(
            HttpMethod.GET,
            basePath + "/" + id + "/studioAssets",
            RequestOptions.builder()
                .queryParam("limit", String.valueOf(limit))
                .queryParam("offset", String.valueOf(offset))
                .build());
    return deserialize(response, new TypeReference<ResultList<OntologyStudioAsset>>() {});
  }

  private <R> R deserialize(String json, TypeReference<R> type) throws OpenMetadataException {
    R result;
    try {
      result = objectMapper.readValue(json, type);
    } catch (JsonProcessingException e) {
      throw new OpenMetadataException(
          "Failed to parse glossary term relations response: " + e.getMessage(), e);
    }
    return result;
  }

  private static RequestOptions toRequestOptions(
      final GlossaryTermRelationGraphOptions graphOptions) {
    final RequestOptions.Builder builder =
        RequestOptions.builder()
            .queryParam("depth", String.valueOf(graphOptions.depth()))
            .queryParam("nodeLimit", String.valueOf(graphOptions.nodeLimit()))
            .queryParam("edgeLimit", String.valueOf(graphOptions.edgeLimit()));
    if (!graphOptions.relationTypes().isEmpty()) {
      builder.queryParam("relationTypes", String.join(",", graphOptions.relationTypes()));
    }
    return builder.build();
  }

  private static RequestOptions studioPageOptions(String parent, int limit, int offset) {
    RequestOptions.Builder options =
        RequestOptions.builder()
            .queryParam("limit", String.valueOf(limit))
            .queryParam("offset", String.valueOf(offset));
    if (parent != null) {
      options.queryParam("parent", parent);
    }
    return options.build();
  }
}
