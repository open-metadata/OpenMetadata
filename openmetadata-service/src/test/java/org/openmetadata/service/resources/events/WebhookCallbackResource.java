package org.openmetadata.service.resources.events;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.ChangeEvent;

/** REST resource used for webhook callback tests. */
@Slf4j
@Path("v1/test/webhook")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class WebhookCallbackResource extends BaseCallbackResource<ChangeEvent> {
  @Override
  protected String getTestName() {
    return "webhookTest";
  }
}
