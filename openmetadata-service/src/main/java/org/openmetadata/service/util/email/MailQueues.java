package org.openmetadata.service.util.email;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/**
 * The threads that hand mail to the SMTP server, one queue per kind of mail. Each sends on one
 * thread, as the mail library did by default, but behind a bounded queue: when it is full, the
 * caller sends the mail itself, so mail waits instead of filling the heap and nothing is dropped.
 * Account mail (password resets, invites) has its own queue, so it never waits behind alerts.
 * The executors live as long as the server and are shared by every mailer built from new
 * settings, so changing the settings starts no new threads.
 */
final class MailQueues {

  static final int NOTIFICATIONS_QUEUED = 1000;
  static final int ACCOUNT_MAIL_QUEUED = 500;

  static final ThreadPoolExecutor NOTIFICATIONS =
      oneSenderBehind("notification-mail", NOTIFICATIONS_QUEUED);
  static final ThreadPoolExecutor ACCOUNT_MAIL =
      oneSenderBehind("account-mail", ACCOUNT_MAIL_QUEUED);

  private MailQueues() {}

  static ThreadPoolExecutor oneSenderBehind(String name, int queued) {
    return new ThreadPoolExecutor(
        1,
        1,
        0L,
        TimeUnit.MILLISECONDS,
        new ArrayBlockingQueue<>(queued),
        Thread.ofPlatform().name(name).daemon().factory(),
        new ThreadPoolExecutor.CallerRunsPolicy());
  }
}
