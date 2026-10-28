package org.openmetadata.it.sso.oidc;

import com.nimbusds.jwt.JWTClaimsSet;
import java.time.Instant;
import java.util.Date;

/** One thing wrong with the next ID token the provider issues. */
public enum IdTokenDefect {
  WRONG_AUDIENCE {
    @Override
    JWTClaimsSet.Builder applyTo(JWTClaimsSet.Builder claims, Instant now) {
      return claims.audience("a-different-client");
    }
  },
  WRONG_ISSUER {
    @Override
    JWTClaimsSet.Builder applyTo(JWTClaimsSet.Builder claims, Instant now) {
      return claims.issuer("https://a-different-issuer.example.com");
    }
  },
  EXPIRED {
    @Override
    JWTClaimsSet.Builder applyTo(JWTClaimsSet.Builder claims, Instant now) {
      return claims.expirationTime(Date.from(now.minusSeconds(60)));
    }
  },
  WRONG_NONCE {
    @Override
    JWTClaimsSet.Builder applyTo(JWTClaimsSet.Builder claims, Instant now) {
      return claims.claim("nonce", "not-the-nonce-the-client-sent");
    }
  },
  /** Signed by a key the JWKS never publishes, as a forged token would be. */
  UNPUBLISHED_KEY {
    @Override
    JWTClaimsSet.Builder applyTo(JWTClaimsSet.Builder claims, Instant now) {
      return claims;
    }
  };

  abstract JWTClaimsSet.Builder applyTo(JWTClaimsSet.Builder claims, Instant now);
}
