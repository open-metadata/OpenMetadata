package org.openmetadata.sdk.services.teams;

import org.openmetadata.schema.api.teams.CreatePersona;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class PersonaService extends EntityServiceBase<Persona> {
  public PersonaService(HttpClient httpClient) {
    super(httpClient, "/v1/personas");
  }

  @Override
  protected Class<Persona> getEntityClass() {
    return Persona.class;
  }

  public Persona create(CreatePersona request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Persona.class);
  }
}
