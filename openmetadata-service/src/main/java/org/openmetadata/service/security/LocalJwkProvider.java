package org.openmetadata.service.security;

import com.auth0.jwk.Jwk;
import com.auth0.jwk.JwkProvider;
import com.auth0.jwk.SigningKeyNotFoundException;
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
  public Jwk get(String kid) throws com.auth0.jwk.JwkException {
    // Only return the key if the kid matches
    if (self.getId().equals(kid)) {
      return self;
    }
    throw new SigningKeyNotFoundException("No key found with kid: " + kid, null);
  }
}
