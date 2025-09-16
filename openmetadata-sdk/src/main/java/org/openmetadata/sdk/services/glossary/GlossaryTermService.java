package org.openmetadata.sdk.services.glossary;

import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class GlossaryTermService extends EntityServiceBase<GlossaryTerm> {
  public GlossaryTermService(HttpClient httpClient) {
    super(httpClient, "/v1/glossaryTerms");
  }

  @Override
  protected Class<GlossaryTerm> getEntityClass() {
    return GlossaryTerm.class;
  }

  // Create glossaryterm using CreateGlossaryTerm request
  public GlossaryTerm create(CreateGlossaryTerm request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, GlossaryTerm.class);
  }
}
