package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.OpenMetadataApplicationConfigHolder;
import org.openmetadata.service.jdbi3.HikariCPDataSourceFactory;

class AsyncServiceTest {

  @AfterEach
  void resetSingleton() throws Exception {
    AsyncService instance = getAsyncServiceInstance();
    if (instance != null) {
      instance.shutdown();
    }
    setAsyncServiceInstance(null);
    setConfigHolderInstance(null);
    Thread.interrupted();
  }

  @Test
  void testSuccessfulExecutionNoRetry() throws Exception {
    setAsyncServiceInstance(newAsyncService());
    AtomicInteger attempts = new AtomicInteger(0);

    CompletableFuture<String> result =
        AsyncService.executeAsync(
            () -> {
              attempts.incrementAndGet();
              return "success";
            },
            "Test",
            "test-context");

    assertEquals("success", result.join());
    assertEquals(1, attempts.get());
  }

  @Test
  void testRetryOnFailureWithExponentialBackoff() throws Exception {
    setAsyncServiceInstance(newAsyncService());
    AtomicInteger attempts = new AtomicInteger(0);
    long startTime = System.currentTimeMillis();

    CompletableFuture<String> result =
        AsyncService.executeAsync(
            () -> {
              int attempt = attempts.incrementAndGet();
              if (attempt < 3) {
                throw new RuntimeException("Simulated failure attempt " + attempt);
              }
              return "success";
            },
            "Test",
            "retry-test");

    assertEquals("success", result.join());
    assertEquals(3, attempts.get());

    long duration = System.currentTimeMillis() - startTime;
    assertTrue(duration >= 3000, "Should take at least 3 seconds (1s + 2s delays)");
  }

  @Test
  void testTimeout() throws Exception {
    setAsyncServiceInstance(newAsyncService());
    CompletableFuture<String> result =
        AsyncService.executeAsync(
            () -> {
              try {
                Thread.sleep(70000);
              } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
              }
              return "should-not-reach";
            },
            "Test",
            "timeout-test",
            3,
            1000,
            2);

    CompletionException exception = assertThrows(CompletionException.class, result::join);
    assertTrue(exception.getCause().getMessage().contains("Test timeout for timeout-test"));
  }

  @Test
  void testCustomRetryConfiguration() throws Exception {
    setAsyncServiceInstance(newAsyncService());
    AtomicInteger attempts = new AtomicInteger(0);
    long startTime = System.currentTimeMillis();

    CompletableFuture<String> result =
        AsyncService.executeAsync(
            () -> {
              int attempt = attempts.incrementAndGet();
              if (attempt < 3) {
                throw new RuntimeException("Simulated failure");
              }
              return "success";
            },
            "CustomTest",
            "custom-retry",
            5,
            500,
            120);

    assertEquals("success", result.join());
    assertEquals(3, attempts.get());

    long duration = System.currentTimeMillis() - startTime;
    assertTrue(duration >= 1500, "Should take at least 1.5 seconds (500ms + 1000ms delays)");
  }

  @Test
  void testRetryWithDifferentExceptionTypes() throws Exception {
    setAsyncServiceInstance(newAsyncService());
    AtomicInteger attempts = new AtomicInteger(0);

    CompletableFuture<String> result =
        AsyncService.executeAsync(
            () -> {
              int attempt = attempts.incrementAndGet();
              if (attempt == 1) {
                throw new IllegalArgumentException("First failure");
              } else if (attempt == 2) {
                throw new IllegalStateException("Second failure");
              }
              return "recovered";
            },
            "Test",
            "exception-test");

    assertEquals("recovered", result.join());
    assertEquals(3, attempts.get());
  }

  @Test
  void testSuccessAfterMaxRetries() throws Exception {
    setAsyncServiceInstance(newAsyncService());
    AtomicInteger attempts = new AtomicInteger(0);

    CompletableFuture<String> result =
        AsyncService.executeAsync(
            () -> {
              int attempt = attempts.incrementAndGet();
              if (attempt <= 3) {
                throw new RuntimeException("Failure " + attempt);
              }
              return "success-on-4th";
            },
            "Test",
            "max-retry-success");

    assertEquals("success-on-4th", result.join());
    assertEquals(4, attempts.get());
  }

  @Test
  void testGetInstanceReturnsSingleton() throws Exception {
    setConfigHolderInstance(null);

    AsyncService first = AsyncService.getInstance();
    AsyncService second = AsyncService.getInstance();

    assertSame(first, second);
    assertTrue(first.getMaxConcurrency() >= 4);
  }

  @Test
  void testExecuteAndSubmitHelpers() throws Exception {
    AsyncService service = newAsyncService();
    CountDownLatch latch = new CountDownLatch(1);

    service.execute(latch::countDown);
    assertTrue(latch.await(5, TimeUnit.SECONDS));
    assertEquals("value", service.submit(() -> "value").join());

    CompletionException exception =
        assertThrows(
            CompletionException.class,
            () ->
                service
                    .submit(
                        () -> {
                          throw new Exception("checked");
                        })
                    .join());
    assertInstanceOf(RuntimeException.class, exception.getCause());
    assertEquals("checked", exception.getCause().getCause().getMessage());

    CompletionException runtimeException =
        assertThrows(
            CompletionException.class,
            () ->
                service
                    .submit(
                        () -> {
                          throw new IllegalStateException("runtime");
                        })
                    .join());
    assertInstanceOf(IllegalStateException.class, runtimeException.getCause());
    assertEquals("runtime", runtimeException.getCause().getMessage());

    service.shutdown();
  }

  @Test
  void testExecuteAsyncValidationAndFailureWrapping() throws Exception {
    setAsyncServiceInstance(newAsyncService());

    assertEquals(
        "task cannot be null",
        assertThrows(
                IllegalArgumentException.class,
                () -> AsyncService.executeAsync(null, "Read", "asset", 0, 1, 1))
            .getMessage());
    assertEquals(
        "operationName cannot be null or blank",
        assertThrows(
                IllegalArgumentException.class,
                () -> AsyncService.executeAsync(() -> "ok", " ", "asset", 0, 1, 1))
            .getMessage());
    assertEquals(
        "context cannot be null",
        assertThrows(
                IllegalArgumentException.class,
                () -> AsyncService.executeAsync(() -> "ok", "Read", null, 0, 1, 1))
            .getMessage());
    assertEquals(
        "maxRetries must be non-negative",
        assertThrows(
                IllegalArgumentException.class,
                () -> AsyncService.executeAsync(() -> "ok", "Read", "asset", -1, 1, 1))
            .getMessage());
    assertEquals(
        "initialRetryDelayMs must be positive",
        assertThrows(
                IllegalArgumentException.class,
                () -> AsyncService.executeAsync(() -> "ok", "Read", "asset", 0, 0, 1))
            .getMessage());
    assertEquals(
        "timeoutSeconds must be positive",
        assertThrows(
                IllegalArgumentException.class,
                () -> AsyncService.executeAsync(() -> "ok", "Read", "asset", 0, 1, 0))
            .getMessage());

    CompletionException exception =
        assertThrows(
            CompletionException.class,
            () ->
                AsyncService.executeAsync(
                        () -> {
                          throw new IllegalStateException("boom");
                        },
                        "Read",
                        "asset",
                        0,
                        1,
                        5)
                    .join());
    assertTrue(exception.getCause().getMessage().contains("Failed to read asset"));
  }

  @Test
  void testExecuteWithRetryInterruptedSleepRestoresInterruptFlag() throws Exception {
    Method method =
        AsyncService.class.getDeclaredMethod(
            "executeWithRetry", Supplier.class, String.class, String.class, int.class, long.class);
    method.setAccessible(true);

    Thread.currentThread().interrupt();
    RuntimeException exception =
        assertThrows(
            RuntimeException.class,
            () ->
                invoke(
                    method,
                    null,
                    (Supplier<String>)
                        () -> {
                          throw new RuntimeException("boom");
                        },
                    "Read",
                    "asset",
                    1,
                    1L));

    assertTrue(exception.getMessage().contains("Retry interrupted for Read: asset"));
    assertTrue(Thread.currentThread().isInterrupted());
    Thread.interrupted();
  }

  @Test
  void testResolveMaxConcurrencyUsesConfigBudgetAndCpuFallback() throws Exception {
    Method method = AsyncService.class.getDeclaredMethod("resolveMaxConcurrency");
    method.setAccessible(true);

    int cpuBudget = Runtime.getRuntime().availableProcessors() * 2;
    setConfigHolderInstance(null);
    assertEquals(Integer.valueOf(Math.max(4, cpuBudget)), invoke(method, null));

    OpenMetadataApplicationConfig config = mock(OpenMetadataApplicationConfig.class);
    HikariCPDataSourceFactory dataSourceFactory = mock(HikariCPDataSourceFactory.class);
    when(config.getDataSourceFactory()).thenReturn(dataSourceFactory);
    when(dataSourceFactory.getMaxSize()).thenReturn(30);
    setConfigHolderInstance(config);

    assertEquals(Integer.valueOf(Math.max(4, Math.min(cpuBudget, 10))), invoke(method, null));
  }

  @Test
  void testBoundedExecutorLifecycleDelegatesState() throws Exception {
    ExecutorService delegate = mock(ExecutorService.class);
    when(delegate.isShutdown()).thenReturn(true);
    when(delegate.isTerminated()).thenReturn(true);
    when(delegate.awaitTermination(5, TimeUnit.SECONDS)).thenReturn(true);

    ExecutorService boundedExecutor = newBoundedExecutorService(delegate);

    assertTrue(boundedExecutor.isShutdown());
    assertTrue(boundedExecutor.isTerminated());
    assertTrue(boundedExecutor.awaitTermination(5, TimeUnit.SECONDS));

    boundedExecutor.shutdown();
    boundedExecutor.shutdownNow();

    verify(delegate).shutdown();
    verify(delegate).shutdownNow();
  }

  @Test
  void testShutdownForcesExecutorOnTimeoutAndInterrupt() throws Exception {
    AsyncService timeoutService = newAsyncService();
    ExecutorService timeoutExecutor = mock(ExecutorService.class);
    when(timeoutExecutor.awaitTermination(30, TimeUnit.SECONDS)).thenReturn(false);
    replaceExecutor(timeoutService, timeoutExecutor);

    timeoutService.shutdown();

    verify(timeoutExecutor).shutdown();
    verify(timeoutExecutor).shutdownNow();

    AsyncService interruptedService = newAsyncService();
    ExecutorService interruptedExecutor = mock(ExecutorService.class);
    when(interruptedExecutor.awaitTermination(30, TimeUnit.SECONDS))
        .thenThrow(new InterruptedException("interrupted"));
    replaceExecutor(interruptedService, interruptedExecutor);

    interruptedService.shutdown();

    verify(interruptedExecutor).shutdown();
    verify(interruptedExecutor).shutdownNow();
    assertTrue(Thread.currentThread().isInterrupted());
    Thread.interrupted();
  }

  private static AsyncService newAsyncService() throws Exception {
    Constructor<AsyncService> constructor = AsyncService.class.getDeclaredConstructor();
    constructor.setAccessible(true);
    return constructor.newInstance();
  }

  private static ExecutorService newBoundedExecutorService(ExecutorService delegate)
      throws Exception {
    Class<?> boundedClass =
        Class.forName("org.openmetadata.service.util.AsyncService$BoundedExecutorService");
    Constructor<?> constructor =
        boundedClass.getDeclaredConstructor(ExecutorService.class, Semaphore.class);
    constructor.setAccessible(true);
    return (ExecutorService) constructor.newInstance(delegate, new Semaphore(1));
  }

  private static void replaceExecutor(AsyncService service, ExecutorService executor)
      throws Exception {
    ExecutorService originalExecutor = service.getExecutorService();
    originalExecutor.shutdownNow();
    Field executorField = AsyncService.class.getDeclaredField("executorService");
    executorField.setAccessible(true);
    executorField.set(service, executor);
  }

  private static AsyncService getAsyncServiceInstance() throws Exception {
    Field field = AsyncService.class.getDeclaredField("instance");
    field.setAccessible(true);
    return (AsyncService) field.get(null);
  }

  private static void setAsyncServiceInstance(AsyncService service) throws Exception {
    Field field = AsyncService.class.getDeclaredField("instance");
    field.setAccessible(true);
    field.set(null, service);
  }

  private static void setConfigHolderInstance(OpenMetadataApplicationConfig config)
      throws Exception {
    Field field = OpenMetadataApplicationConfigHolder.class.getDeclaredField("instance");
    field.setAccessible(true);
    field.set(null, config);
  }

  @SuppressWarnings("unchecked")
  private static <T> T invoke(Method method, Object target, Object... args) {
    try {
      return (T) method.invoke(target, args);
    } catch (InvocationTargetException e) {
      if (e.getCause() instanceof RuntimeException runtimeException) {
        throw runtimeException;
      }
      throw new RuntimeException(e.getCause());
    } catch (ReflectiveOperationException e) {
      throw new RuntimeException(e);
    }
  }
}
