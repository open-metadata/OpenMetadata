package org.openmetadata.service.util.email;

import java.util.concurrent.CompletableFuture;

public interface EmailSender {
  boolean isEnabled();

  CompletableFuture<Void> send(String to, String subject, String htmlContent);
}
