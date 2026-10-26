package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.WebApplicationException;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.SubscriptionDestination;

class TestSendsTest {

  private static final Duration SHORT = Duration.ofMillis(300);

  @Test
  void destinationsThatNeverAnswerAreReportedTimedOutWithinTheDeadline() {
    CountDownLatch never = new CountDownLatch(1);
    List<SubscriptionDestination> silent = destinations(3);

    List<String> results =
        assertTimeoutPreemptively(
            Duration.ofSeconds(5),
            () ->
                TestSends.within(
                    new Semaphore(1),
                    SHORT,
                    silent,
                    destination -> waitFor(never),
                    destination -> "timed out " + destination.getId()));

    assertEquals(
        silent.stream().map(destination -> "timed out " + destination.getId()).toList(), results);
  }

  @Test
  void destinationsAreSentToTogetherAndAnsweredInRequestOrder() {
    CountDownLatch allStarted = new CountDownLatch(3);
    List<SubscriptionDestination> three = destinations(3);

    List<String> results =
        TestSends.within(
            new Semaphore(1),
            Duration.ofSeconds(10),
            three,
            destination -> startedTogether(allStarted, destination),
            destination -> "timed out");

    assertEquals(
        three.stream().map(destination -> destination.getId().toString()).toList(), results);
  }

  @Test
  void aRequestBeyondTheConcurrentLimitIsToldToTryAgain() {
    Semaphore none = new Semaphore(0);

    WebApplicationException refused =
        assertThrows(
            WebApplicationException.class,
            () -> TestSends.within(none, SHORT, destinations(1), d -> "sent", d -> "timed out"));

    assertEquals(429, refused.getResponse().getStatus());
  }

  @Test
  void aSendThatRefusesItsDestinationFailsTheRequestAsBefore() {
    assertThrows(
        BadRequestException.class,
        () ->
            TestSends.within(
                new Semaphore(1),
                SHORT,
                destinations(1),
                destination -> {
                  throw new BadRequestException("not a usable destination");
                },
                destination -> "timed out"));
  }

  private static String startedTogether(
      CountDownLatch allStarted, SubscriptionDestination destination) {
    allStarted.countDown();
    waitFor(allStarted);
    return destination.getId().toString();
  }

  private static String waitFor(CountDownLatch latch) {
    try {
      latch.await(30, TimeUnit.SECONDS);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
    return "answered";
  }

  private static List<SubscriptionDestination> destinations(int count) {
    return IntStream.range(0, count)
        .mapToObj(index -> new SubscriptionDestination().withId(UUID.randomUUID()))
        .toList();
  }
}
