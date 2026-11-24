package org.openmetadata.service.apps;

import java.util.List;
import org.openmetadata.service.security.AuthRequest;

public record AppTrigger(List<AuthRequest> authRequests, Runnable action) {
  public AppTrigger {
    authRequests = List.copyOf(authRequests);
  }

  public void run() {
    action.run();
  }
}
