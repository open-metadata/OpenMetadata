package org.openmetadata.service.resources.events;

import javax.ws.rs.Consumes;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage;

/** REST resource used for msteams callback tests. */
@Slf4j
@Path("v1/test/msteams")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class MSTeamsCallbackResource extends BaseCallbackResource<TeamsMessage> {
  @Override
  protected String getTestName() {
    return "teamsTest";
  }
}
