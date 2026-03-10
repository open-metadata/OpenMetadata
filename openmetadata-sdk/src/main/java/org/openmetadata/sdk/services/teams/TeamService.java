package org.openmetadata.sdk.services.teams;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.Map;
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

  public Map<String, Integer> getAllTeamsWithAssetsCount() throws OpenMetadataException {
    String responseStr =
        httpClient.executeForString(HttpMethod.GET, basePath + "/assets/counts", null, null);
    try {
      return objectMapper.readValue(responseStr, new TypeReference<Map<String, Integer>>() {});
    } catch (Exception e) {
      throw new OpenMetadataException(
          "Failed to deserialize getAllTeamsWithAssetsCount response: " + e.getMessage(), e);
    }
  }
}
