package org.openmetadata.catalog.security.jwt;

import lombok.Getter;
import lombok.Setter;

public class JWTTokenConfiguration {
  @Getter @Setter private String RSAPublicKeyFilePath;
  @Getter @Setter private String RSAPrivateKeyFilePath;
  @Getter @Setter private String JWTIssuer;
  @Getter @Setter private String keyId;
}
