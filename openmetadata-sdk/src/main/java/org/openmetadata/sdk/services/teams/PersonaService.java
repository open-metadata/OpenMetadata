package org.openmetadata.sdk.services.teams;

import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.resources.BaseResource;

public class PersonaService extends BaseResource<Persona> {
  public PersonaService(HttpClient httpClient) {
    super(httpClient, "/v1/personas");
  }

  @Override
  protected Class<Persona> getEntityClass() {
    return Persona.class;
  }
}
