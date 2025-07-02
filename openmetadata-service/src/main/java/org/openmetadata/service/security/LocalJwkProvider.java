package org.openmetadata.service.security;

import com.auth0.jwk.Jwk;
import com.auth0.jwk.JwkProvider;
import java.util.Map;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

public class LocalJwkProvider implements JwkProvider {
  private final Jwk self;

  LocalJwkProvider() {
    var jwtGen = JWTTokenGenerator.getInstance();
    var key = jwtGen.getJWKSResponse().getJwsKeys().getFirst();
    self =
        Jwk.fromValues(
            Map.of(
                "kid", key.getKid(),
                "kty", key.getKty(),
                "n", key.getN(),
                "e", key.getE()));
  }

  @Override
  public Jwk get(String kid) {
    return self;
  }
}
