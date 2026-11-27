package org.openmetadata.it.sso.oidc;

/**
 * Whether the provider advertises RFC 9207's {@code iss} authorization-response parameter, and what
 * its callbacks then carry.
 */
public enum IssuerParameter {
  NOT_ADVERTISED,
  CORRECT,
  WRONG,
  OMITTED;

  boolean isAdvertised() {
    return this != NOT_ADVERTISED;
  }
}
