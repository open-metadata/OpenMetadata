package org.openmetadata.service.util.email;

import java.util.concurrent.CompletableFuture;

public final class DefaultEmailSender implements EmailSender {
  @Override
  public boolean isEnabled() {
    return Boolean.TRUE.equals(EmailUtil.getSmtpSettings().getEnableSmtpServer());
  }

  @Override
  public CompletableFuture<Void> send(String to, String subject, String htmlContent) {
    return EmailUtil.sendNotificationEmailAsync(to, subject, htmlContent);
  }
}
