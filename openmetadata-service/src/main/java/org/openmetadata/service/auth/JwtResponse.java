package org.openmetadata.service.auth;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class JwtResponse {
  private String accessToken;
  private String refreshToken;
  private String tokenType = "Bearer ";
  private Long expiryDuration;
}
