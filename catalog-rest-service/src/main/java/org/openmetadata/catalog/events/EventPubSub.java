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

package org.openmetadata.catalog.events;

import com.lmax.disruptor.BatchEventProcessor;
import com.lmax.disruptor.EventFactory;
import com.lmax.disruptor.EventHandler;
import com.lmax.disruptor.ExceptionHandler;
import com.lmax.disruptor.RingBuffer;
import com.lmax.disruptor.dsl.Disruptor;
import com.lmax.disruptor.util.DaemonThreadFactory;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.type.ChangeEvent;

@Slf4j
/** Change event PubSub built based on LMAX Disruptor. */
public class EventPubSub {
  private static Disruptor<ChangeEventHolder> disruptor;
  private static ExecutorService executor;
  private static RingBuffer<ChangeEventHolder> ringBuffer;
  private static boolean started = false;

  public static void start() {
    if (!started) {
      disruptor = new Disruptor<>(ChangeEventHolder::new, 1024, DaemonThreadFactory.INSTANCE);
      disruptor.setDefaultExceptionHandler(new DefaultExceptionHandler());
      executor = Executors.newCachedThreadPool(DaemonThreadFactory.INSTANCE);
      ringBuffer = disruptor.start();
      LOG.info("Disruptor started");
      started = true;
    }
  }

  public static void shutdown() throws InterruptedException {
    if (started) {
      disruptor.shutdown();
      disruptor.halt();
      executor.shutdownNow();
      executor.awaitTermination(10, TimeUnit.SECONDS);
      disruptor = null;
      ringBuffer = null;
      started = false;
      LOG.info("Disruptor stopped");
    }
  }

  public static class ChangeEventHolder {
    private ChangeEvent value;

    public void set(ChangeEvent event) {
      this.value = event;
    }

    public ChangeEvent get() {
      return value;
    }
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
      ringBuffer.get(sequence).set(event);
      ringBuffer.publish(sequence);
    }
  }

  public static BatchEventProcessor<ChangeEventHolder> addEventHandler(EventHandler<ChangeEventHolder> eventHandler) {
    BatchEventProcessor<ChangeEventHolder> processor =
        new BatchEventProcessor<>(ringBuffer, ringBuffer.newBarrier(), eventHandler);
    processor.setExceptionHandler(new DefaultExceptionHandler());
    ringBuffer.addGatingSequences(processor.getSequence());
    executor.execute(processor);
    LOG.info("Processor added for {}", processor);
    return processor;
  }

  public static void removeProcessor(BatchEventProcessor<ChangeEventHolder> processor) {
    ringBuffer.removeGatingSequence(processor.getSequence());
    LOG.info("Processor removed for {}", processor);
  }

  public void close() {}

  public static class DefaultExceptionHandler implements ExceptionHandler<ChangeEventHolder> {
    @Override
    public void handleEventException(Throwable throwable, long l, ChangeEventHolder changeEventHolder) {
      LOG.warn("Disruptor error in onEvent {}", throwable.getMessage());
      throw new RuntimeException(throwable.getMessage()); // Throw runtime exception to stop the event handler thread
    }

    @Override
    public void handleOnStartException(Throwable throwable) {
      LOG.warn("Disruptor error in onStart {}", throwable.getMessage());
    }

    @Override
    public void handleOnShutdownException(Throwable throwable) {
      LOG.warn("Disruptor error on onShutdown {}", throwable.getMessage());
    }
  }
}
