package org.openmetadata.schema;

import java.util.UUID;
import org.openmetadata.schema.auth.TokenType;

public interface TokenInterface {
  UUID getToken();

  UUID getUserId();

  TokenType getTokenType();

  Long getExpiryDate();

  void setToken(UUID id);

  void setUserId(UUID id);

  void setTokenType(TokenType type);

  void setExpiryDate(Long expiry);
}
