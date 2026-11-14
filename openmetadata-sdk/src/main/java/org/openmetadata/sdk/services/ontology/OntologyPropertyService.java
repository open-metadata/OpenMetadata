package org.openmetadata.sdk.services.ontology;

import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public final class OntologyPropertyService extends EntityServiceBase<OntologyProperty> {
  public OntologyPropertyService(final HttpClient httpClient) {
    super(httpClient, "/v1/ontologyProperties");
  }

  public OntologyProperty create(final CreateOntologyProperty request) {
    return httpClient.execute(HttpMethod.POST, basePath, request, OntologyProperty.class);
  }

  public OntologyProperty upsert(final CreateOntologyProperty request) {
    return httpClient.execute(HttpMethod.PUT, basePath, request, OntologyProperty.class);
  }

  @Override
  protected Class<OntologyProperty> getEntityClass() {
    return OntologyProperty.class;
  }
}
