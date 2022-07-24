package org.openmetadata.catalog.security.jwt;

import javax.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

public class JWKSKey {
  @NotEmpty @Getter @Setter private String kty;
  @NotEmpty @Getter @Setter private String kid;
  @NotEmpty @Getter @Setter private String n;
  @NotEmpty @Getter @Setter private String e;
  @NotEmpty @Getter @Setter private String alg = "RS256";
  @NotEmpty @Getter @Setter private String use = "sig";
}
