package org.openmetadata.sdk.util;

import java.time.Duration;

public class Stopwatch {
  private long elapsed;
  private boolean running;
  private long startTimeStamp;

  public Stopwatch() {
    this.reset();
  }

  public void start() {
    if (!this.running) {
      this.startTimeStamp = getTimestamp();
      this.running = true;
    }
  }

  public static Stopwatch startNew() {
    Stopwatch s = new Stopwatch();
    s.start();
    return s;
  }

  public void stop() {
    // Calling stop on a stopped Stopwatch is a no-op.
    if (!this.running) {
      return;
    }

    long endTimeStamp = getTimestamp();
    long elapsedThisPeriod = endTimeStamp - this.startTimeStamp;
    this.elapsed += elapsedThisPeriod;
    this.running = false;
  }

  public void reset() {
    this.elapsed = 0;
    this.running = false;
    this.startTimeStamp = 0;
  }

  public void restart() {
    this.elapsed = 0;
    this.running = true;
    this.startTimeStamp = getTimestamp();
  }


  public boolean isRunning() {
    return this.running;
  }

  public Duration getElapsed() {
    return Duration.ofNanos(this.getRawElapsed());
  }


  public static long getTimestamp() {
    return System.nanoTime();
  }

  private long getRawElapsed() {
    long timeElapsed = this.elapsed;

    // If the Stopwatch is running, add elapsed time since the Stopwatch is started last time.
    if (this.running) {
      long currentTimeStamp = getTimestamp();
      long elapsedUntilNow = currentTimeStamp - this.startTimeStamp;
      timeElapsed += elapsedUntilNow;
    }

    return timeElapsed;
  }
}
