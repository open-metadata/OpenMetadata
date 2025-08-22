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

package org.openmetadata.service.events;

import com.lmax.disruptor.BatchEventProcessor;
import com.lmax.disruptor.EventFactory;
import com.lmax.disruptor.EventHandler;
import com.lmax.disruptor.ExceptionHandler;
import com.lmax.disruptor.RingBuffer;
import com.lmax.disruptor.dsl.Disruptor;
import com.lmax.disruptor.util.DaemonThreadFactory;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.events.EventPubSub.ChangeEventHolder;
import org.openmetadata.service.util.AsyncService;

/** Change event PubSub built based on LMAX Disruptor. */
@Slf4j
public class EventPubSub {
  private static Disruptor<ChangeEventHolder> disruptor;
  private static ExecutorService executor;
  private static RingBuffer<ChangeEventHolder> ringBuffer;
  private static boolean started = false;

  public static void start() {
    if (!started) {
      disruptor = new Disruptor<>(ChangeEventHolder::new, 1024, DaemonThreadFactory.INSTANCE);
      disruptor.setDefaultExceptionHandler(new ShutdownAwareExceptionHandler());
      executor = AsyncService.getInstance().getExecutorService();
      ringBuffer = disruptor.start();
      LOG.info("Disruptor started");
      started = true;
    }
  }

  public static void shutdown() throws InterruptedException {
    if (started) {
      LOG.info("Shutting down EventPubSub...");
      try {
        disruptor.shutdown();
        Thread.sleep(100);
        disruptor.halt();
        executor.shutdown();
        if (!executor.awaitTermination(5, TimeUnit.SECONDS)) {
          LOG.warn("Executor did not terminate gracefully, forcing shutdown");
          executor.shutdownNow();
          // Wait a bit more after forced shutdown
          executor.awaitTermination(2, TimeUnit.SECONDS);
        }
      } catch (InterruptedException e) {
        LOG.warn("Interrupted during EventPubSub shutdown", e);
        Thread.currentThread().interrupt();
      } finally {
        disruptor = null;
        ringBuffer = null;
        started = false;
        LOG.info("Disruptor stopped");
      }
    }
  }

  public static class ChangeEventHolder {
    @Getter @Setter private ChangeEvent event;
  }

  public static class ChangeEventFactory implements EventFactory<ChangeEventHolder> {
    public ChangeEventHolder newInstance() {
      return new ChangeEventHolder();
    }
  }

  public static void publish(ChangeEvent event) {
    if (event != null) {
      RingBuffer<ChangeEventHolder> ringBuffer = disruptor.getRingBuffer();
      long sequence = ringBuffer.next();
      ringBuffer.get(sequence).setEvent(event);
      ringBuffer.publish(sequence);
    }
  }

  public static BatchEventProcessor<ChangeEventHolder> addEventHandler(
      EventHandler<ChangeEventHolder> eventHandler) {
    BatchEventProcessor<ChangeEventHolder> processor =
        new BatchEventProcessor<>(ringBuffer, ringBuffer.newBarrier(), eventHandler);
    processor.setExceptionHandler(new ShutdownAwareExceptionHandler());
    ringBuffer.addGatingSequences(processor.getSequence());
    executor.execute(processor);
    LOG.info("Processor added for {}", processor);
    return processor;
  }

  public static void removeProcessor(BatchEventProcessor<ChangeEventHolder> processor) {
    ringBuffer.removeGatingSequence(processor.getSequence());
    LOG.info("Processor removed for {}", processor);
  }

  public void close() {
    /* Nothing to clean up */
  }

  /**
   * Custom exception handler that gracefully handles interruptions during shutdown
   */
  private static class ShutdownAwareExceptionHandler
      implements ExceptionHandler<ChangeEventHolder> {
    @Override
    public void handleEventException(Throwable ex, long sequence, ChangeEventHolder event) {
      if (ex instanceof InterruptedException
          || (ex instanceof RuntimeException && ex.getCause() instanceof InterruptedException)) {
        LOG.debug("Event processing interrupted during shutdown (sequence: {})", sequence);
      } else {
        LOG.error("Exception processing event at sequence {}: {}", sequence, ex.getMessage(), ex);
      }
    }

    @Override
    public void handleOnStartException(Throwable ex) {
      LOG.error("Exception during event processor startup: {}", ex.getMessage(), ex);
    }

    @Override
    public void handleOnShutdownException(Throwable ex) {
      if (ex instanceof InterruptedException
          || (ex instanceof RuntimeException && ex.getCause() instanceof InterruptedException)) {
        LOG.debug("Event processor interrupted during shutdown");
      } else {
        LOG.error("Exception during event processor shutdown: {}", ex.getMessage(), ex);
      }
    }
  }
}
