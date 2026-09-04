package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class ImpersonationRestrictionFilterTest {

  @Test
  void identityEndpointsAreClosedToImpersonation() {
    // GHSA-gxpr-mwqj-gjmr: an impersonated principal minted a standalone admin PAT. Impersonation
    // lasts one request; a credential it reads, mints or revokes outlives the grant, so the whole
    // identity surface is off-limits while the principal has been swapped.
    assertTrue(ImpersonationRestrictionFilter.isIdentityEndpoint("v1/users/security/token"));
    assertTrue(ImpersonationRestrictionFilter.isIdentityEndpoint("v1/users/security/token/revoke"));
    assertTrue(ImpersonationRestrictionFilter.isIdentityEndpoint("v1/users/generateToken"));
    assertTrue(
        ImpersonationRestrictionFilter.isIdentityEndpoint(
            "v1/users/generateToken/" + UUID.randomUUID()));
    assertTrue(ImpersonationRestrictionFilter.isIdentityEndpoint("v1/users/revokeToken"));
    // Both of these hand back a bot's JWT and are gated only by authorizeAdmin.
    assertTrue(
        ImpersonationRestrictionFilter.isIdentityEndpoint("v1/users/token/" + UUID.randomUUID()));
    assertTrue(
        ImpersonationRestrictionFilter.isIdentityEndpoint(
            "v1/users/auth-mechanism/" + UUID.randomUUID()));
    assertTrue(ImpersonationRestrictionFilter.isIdentityEndpoint("v1/users/changePassword"));
    assertTrue(ImpersonationRestrictionFilter.isIdentityEndpoint("v1/users/generateRandomPwd"));
    assertTrue(ImpersonationRestrictionFilter.isIdentityEndpoint("v1/users/logout"));
  }

  @Test
  void ordinaryEndpointsStayOpenToImpersonation() {
    // Impersonation exists so application bots can read and write metadata as a user. Only the
    // identity surface is blocked - a prefix that is merely similar must not be swept up.
    assertFalse(ImpersonationRestrictionFilter.isIdentityEndpoint("v1/users"));
    assertFalse(ImpersonationRestrictionFilter.isIdentityEndpoint("v1/users/" + UUID.randomUUID()));
    assertFalse(ImpersonationRestrictionFilter.isIdentityEndpoint("v1/users/name/alice"));
    assertFalse(
        ImpersonationRestrictionFilter.isIdentityEndpoint("v1/users/security/tokenholders"));
    assertFalse(ImpersonationRestrictionFilter.isIdentityEndpoint("v1/tables"));
  }
}
