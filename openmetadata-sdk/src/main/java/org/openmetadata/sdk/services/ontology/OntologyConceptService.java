package org.openmetadata.sdk.services.ontology;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public final class OntologyConceptService extends EntityServiceBase<OntologyConcept> {
  public OntologyConceptService(final HttpClient httpClient) {
    super(httpClient, "/v1/ontologyConcepts");
  }

  public OntologyConcept create(final CreateOntologyConcept request) {
    return httpClient.execute(HttpMethod.POST, basePath, request, OntologyConcept.class);
  }

  public OntologyConcept upsert(final CreateOntologyConcept request) {
    return httpClient.execute(HttpMethod.PUT, basePath, request, OntologyConcept.class);
  }

  @Override
  protected void normalizePatchNodes(
      final JsonNode original, final JsonNode updated, final OntologyConcept entity) {
    for (final String field : List.of("superClasses", "subClasses", "lifecycleStatus")) {
      removeField(original, field);
      removeField(updated, field);
    }
  }

  @Override
  protected Class<OntologyConcept> getEntityClass() {
    return OntologyConcept.class;
  }
}
