package org.openmetadata.service.util;

import static org.openmetadata.schema.auth.TokenType.EMAIL_VERIFICATION;
import static org.openmetadata.schema.auth.TokenType.PASSWORD_RESET;
import static org.openmetadata.schema.auth.TokenType.REFRESH_TOKEN;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.openmetadata.schema.TokenInterface;
import org.openmetadata.schema.auth.EmailVerificationToken;
import org.openmetadata.schema.auth.PasswordResetToken;
import org.openmetadata.schema.auth.RefreshToken;
import org.openmetadata.schema.auth.TokenType;

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
}
