package org.openmetadata.sdk.services.glossary;

import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class GlossaryTermService extends EntityServiceBase<GlossaryTerm> {
  public GlossaryTermService(HttpClient httpClient) {
    super(httpClient, "/v1/glossaryTerms");
  }

  @Override
  protected Class<GlossaryTerm> getEntityClass() {
    return GlossaryTerm.class;
  }
}
