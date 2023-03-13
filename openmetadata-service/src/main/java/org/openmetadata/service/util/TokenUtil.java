/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.util;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.openmetadata.schema.TokenInterface;
import org.openmetadata.schema.auth.EmailVerificationToken;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.PasswordResetToken;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.auth.RefreshToken;
import org.openmetadata.schema.auth.TokenType;
import org.openmetadata.schema.entity.teams.User;

public class TokenUtil {
  private TokenUtil() {}

  public static TokenInterface createNewTokenWithDefaults(UUID userId, UUID tokenId, TokenType type) {
    switch (type) {
      case EMAIL_VERIFICATION:
        return getEmailVerificationToken(userId, tokenId);
      case PASSWORD_RESET:
        return getPasswordResetToken(userId, tokenId);
      case REFRESH_TOKEN:
        return getRefreshToken(userId, tokenId);
      default:
        throw new RuntimeException("Invalid Token Type.");
    }
  }

  public static EmailVerificationToken getEmailVerificationToken(UUID userId, UUID token) {
    EmailVerificationToken emailVerificationToken = new EmailVerificationToken();
    emailVerificationToken.setToken(token);
    emailVerificationToken.setTokenType(TokenType.EMAIL_VERIFICATION);
    emailVerificationToken.setTokenStatus(EmailVerificationToken.TokenStatus.STATUS_PENDING);
    emailVerificationToken.setUserId(userId);
    emailVerificationToken.setExpiryDate(Instant.now().plus(24, ChronoUnit.HOURS).toEpochMilli());
    return emailVerificationToken;
  }

  public static PasswordResetToken getPasswordResetToken(UUID userId, UUID token) {
    PasswordResetToken passwordResetToken = new PasswordResetToken();
    passwordResetToken.setToken(token);
    passwordResetToken.setTokenType(TokenType.PASSWORD_RESET);
    passwordResetToken.setIsActive(true);
    passwordResetToken.setIsClaimed(false);
    passwordResetToken.setUserId(userId);
    passwordResetToken.setExpiryDate(Instant.now().plus(1, ChronoUnit.HOURS).toEpochMilli());
    return passwordResetToken;
  }

  public static RefreshToken getRefreshToken(UUID userId, UUID token) {
    RefreshToken refreshToken = new RefreshToken();
    refreshToken.setToken(token);
    refreshToken.setTokenType(TokenType.REFRESH_TOKEN);
    refreshToken.setUserId(userId);
    refreshToken.setRefreshCount(0);
    refreshToken.setMaxRefreshCount(3);
    refreshToken.setExpiryDate(Instant.now().plus(30, ChronoUnit.DAYS).toEpochMilli());
    return refreshToken;
  }

  public static PersonalAccessToken getPersonalAccessToken(User user, JWTAuthMechanism authMechanism) {
    PersonalAccessToken personalAccessToken = new PersonalAccessToken();
    personalAccessToken.setToken(UUID.randomUUID());
    personalAccessToken.setUserId(user.getId());
    personalAccessToken.setTokenType(TokenType.PERSONAL_ACCESS);
    personalAccessToken.setJwtToken(authMechanism.getJWTToken());
    personalAccessToken.setExpiryDate(authMechanism.getJWTTokenExpiresAt());
    return personalAccessToken;
  }
}
