package org.openmetadata.service.resources.policies;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.openmetadata.service.resources.EntityResource;

class PolicyResourceStartupTest {
  @Test
  void startupDoesNotRewriteSeededPolicies() throws Exception {
    // The registry calls upgrade() on every resource at each start; an override that edits seeded
    // policies would undo an admin's changes on every restart
    // (ADR:2026-11-03-seeded-policies-are-not-reset-on-startup).
    assertEquals(
        EntityResource.class, PolicyResource.class.getMethod("upgrade").getDeclaringClass());
  }
}
