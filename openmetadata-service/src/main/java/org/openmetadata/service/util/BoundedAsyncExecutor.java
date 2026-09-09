/*
 *  Copyright 2026 Collate
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

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.AbstractExecutorService;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/** Executor view that limits concurrently running tasks without rejecting submissions. */
public final class BoundedAsyncExecutor extends AbstractExecutorService {
  private static final Runnable NO_OP = () -> {};
  private final ExecutorService delegate;
  private final Semaphore semaphore;
  private final int maxConcurrentTasks;

  public BoundedAsyncExecutor(ExecutorService delegate, int maxConcurrentTasks) {
    if (maxConcurrentTasks < 1) {
      throw new IllegalArgumentException("maxConcurrentTasks must be positive");
    }
    this.delegate = Objects.requireNonNull(delegate);
    this.semaphore = new Semaphore(maxConcurrentTasks, true);
    this.maxConcurrentTasks = maxConcurrentTasks;
  }

  @Override
  public void execute(Runnable command) {
    execute(command, NO_OP);
  }

  void execute(Runnable command, Runnable onDiscard) {
    Objects.requireNonNull(command);
    Objects.requireNonNull(onDiscard);
    delegate.execute(new PermitRunnable(command, onDiscard));
  }

  private void runWithPermit(PermitRunnable task) {
    boolean permitAcquired = false;
    try {
      semaphore.acquire();
      permitAcquired = true;
    } catch (InterruptedException e) {
      task.cancel();
      Thread.currentThread().interrupt();
    }
    if (permitAcquired) {
      try {
        task.runCommand();
      } finally {
        semaphore.release();
      }
    }
  }

  private static void cancelIfFuture(Runnable command) {
    if (command instanceof Future<?> future) {
      future.cancel(false);
    }
  }

  public int getActiveCount() {
    return maxConcurrentTasks - semaphore.availablePermits();
  }

  public int getQueuedCount() {
    return semaphore.getQueueLength();
  }

  @Override
  public void shutdown() {
    delegate.shutdown();
  }

  @Override
  public List<Runnable> shutdownNow() {
    final List<Runnable> pendingTasks = delegate.shutdownNow();
    final List<Runnable> unwrappedTasks = new ArrayList<>(pendingTasks.size());
    for (Runnable pendingTask : pendingTasks) {
      if (pendingTask instanceof PermitRunnable permitTask) {
        permitTask.cancel();
        unwrappedTasks.add(permitTask.command);
      } else {
        unwrappedTasks.add(pendingTask);
      }
    }
    return unwrappedTasks;
  }

  @Override
  public boolean isShutdown() {
    return delegate.isShutdown();
  }

  @Override
  public boolean isTerminated() {
    return delegate.isTerminated();
  }

  @Override
  public boolean awaitTermination(long timeout, TimeUnit unit) throws InterruptedException {
    return delegate.awaitTermination(timeout, unit);
  }

  private final class PermitRunnable implements Runnable {
    private final Runnable command;
    private final Runnable onDiscard;
    private final AtomicBoolean claimed = new AtomicBoolean();

    private PermitRunnable(Runnable command, Runnable onDiscard) {
      this.command = command;
      this.onDiscard = onDiscard;
    }

    @Override
    public void run() {
      runWithPermit(this);
    }

    private void runCommand() {
      if (claimed.compareAndSet(false, true)) {
        command.run();
      }
    }

    private void cancel() {
      if (claimed.compareAndSet(false, true)) {
        cancelIfFuture(command);
        onDiscard.run();
      }
    }
  }
}
