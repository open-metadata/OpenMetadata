package org.openmetadata.sdk.services.glossary;

import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class GlossaryService extends EntityServiceBase<Glossary> {
  public GlossaryService(HttpClient httpClient) {
    super(httpClient, "/v1/glossaries");
  }

  @Override
  protected Class<Glossary> getEntityClass() {
    return Glossary.class;
  }
}
