package org.openmetadata.catalog.security.jwt;

import lombok.Getter;
import lombok.Setter;

public class JWTTokenConfiguration {
  @Getter @Setter private String RSAPublicKey;
  @Getter @Setter private String RSAPrivateKey;
  @Getter @Setter private String JWTIssuer;
}
