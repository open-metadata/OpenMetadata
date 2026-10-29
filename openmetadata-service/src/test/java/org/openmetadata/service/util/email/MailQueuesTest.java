package org.openmetadata.service.util.email;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class MailQueuesTest {

  private static final int QUEUED = 3;

  @Test
  void whenTheQueueIsFullTheCallerSendsTheMailItselfAndNothingIsDropped() throws Exception {
    ThreadPoolExecutor senders = MailQueues.oneSenderBehind("test-mail", QUEUED);
    CountDownLatch smtpAnswers = new CountDownLatch(1);
    try {
      senders.execute(() -> await(smtpAnswers));
      for (int mail = 0; mail < QUEUED; mail++) {
        senders.execute(() -> await(smtpAnswers));
      }
      AtomicReference<Thread> sentBy = new AtomicReference<>();

      senders.execute(() -> sentBy.set(Thread.currentThread()));

      assertEquals(
          Thread.currentThread(), sentBy.get(), "the caller sent the mail that did not fit");
      assertEquals(QUEUED, senders.getQueue().size(), "the queue never grows past its bound");
    } finally {
      smtpAnswers.countDown();
      senders.shutdown();
      assertTrue(senders.awaitTermination(10, TimeUnit.SECONDS));
    }
    assertEquals(
        QUEUED + 1, senders.getCompletedTaskCount(), "every queued mail was sent by the sender");
  }

  @Test
  void accountMailHasItsOwnBoundedQueue() {
    assertNotSame(MailQueues.NOTIFICATIONS, MailQueues.ACCOUNT_MAIL);
    assertEquals(
        MailQueues.NOTIFICATIONS_QUEUED, MailQueues.NOTIFICATIONS.getQueue().remainingCapacity());
    assertEquals(
        MailQueues.ACCOUNT_MAIL_QUEUED, MailQueues.ACCOUNT_MAIL.getQueue().remainingCapacity());
    assertEquals(1, MailQueues.NOTIFICATIONS.getMaximumPoolSize(), "one sender, as before");
  }

  private static void await(CountDownLatch latch) {
    try {
      latch.await(30, TimeUnit.SECONDS);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
