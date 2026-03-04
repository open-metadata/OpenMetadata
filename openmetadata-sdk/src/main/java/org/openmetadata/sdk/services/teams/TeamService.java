package org.openmetadata.sdk.services.teams;

import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class TeamService extends EntityServiceBase<Team> {
  public TeamService(HttpClient httpClient) {
    super(httpClient, "/v1/teams");
  }

  @Override
  protected Class<Team> getEntityClass() {
    return Team.class;
  }

  // Create team using CreateTeam request
  public Team create(CreateTeam request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Team.class);
  }
}
