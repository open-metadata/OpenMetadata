package org.openmetadata.sdk.services.glossary;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TermRelation;
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
   * @return a map with {@code nodes} and {@code edges} entries
   */
  public Map<String, Object> relationGraph(UUID id, int depth, List<String> relationTypes)
      throws OpenMetadataException {
    RequestOptions.Builder options =
        RequestOptions.builder().queryParam("depth", String.valueOf(depth));
    if (relationTypes != null && !relationTypes.isEmpty()) {
      options.queryParam("relationTypes", String.join(",", relationTypes));
    }
    String response =
        httpClient.executeForString(
            HttpMethod.GET, basePath + "/" + id + "/relationsGraph", null, options.build());
    return deserialize(response, new TypeReference<Map<String, Object>>() {});
  }

  /** Return per-relation-type usage counts across all glossary terms. */
  public Map<String, Integer> relationTypeUsage() throws OpenMetadataException {
    String response =
        httpClient.executeForString(HttpMethod.GET, basePath + "/relationTypes/usage", null);
    return deserialize(response, new TypeReference<Map<String, Integer>>() {});
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
}
