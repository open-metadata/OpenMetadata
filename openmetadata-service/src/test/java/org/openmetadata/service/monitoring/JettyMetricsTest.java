package org.openmetadata.service.monitoring;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.micrometer.prometheusmetrics.PrometheusConfig;
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.util.thread.QueuedThreadPool;
import org.junit.jupiter.api.Test;

class JettyMetricsTest {

  @Test
  void reportsBusyThreadsAgainstCapacityAsThePoolChanges() {
    QueuedThreadPool pool = mock(QueuedThreadPool.class);
    when(pool.getThreads()).thenReturn(13);
    when(pool.getBusyThreads()).thenReturn(10);
    when(pool.getMaxThreads()).thenReturn(50);

    PrometheusMeterRegistry registry = new PrometheusMeterRegistry(PrometheusConfig.DEFAULT);
    try {
      registry.throwExceptionOnRegistrationFailure();
      new JettyMetrics(new Server(pool)).bindTo(registry);

      assertEquals(20.0, registry.get("jetty.threads.utilization").gauge().value());
      assertEquals(0.2, registry.get("jetty.threads.utilization.ratio").gauge().value());
      assertTrue(registry.scrape().contains("# TYPE jetty_threads_utilization_ratio gauge"));

      when(pool.getThreads()).thenReturn(30);
      assertEquals(0.2, registry.get("jetty.threads.utilization.ratio").gauge().value());

      when(pool.getMaxThreads()).thenReturn(8);
      assertEquals(1.0, registry.get("jetty.threads.utilization.ratio").gauge().value());
      assertEquals(100.0, registry.get("jetty.threads.utilization").gauge().value());

      when(pool.getMaxThreads()).thenReturn(0);
      assertEquals(0.0, registry.get("jetty.threads.utilization.ratio").gauge().value());
      assertEquals(0.0, registry.get("jetty.threads.utilization").gauge().value());

      when(pool.getMaxThreads()).thenReturn(50);
      when(pool.getBusyThreads()).thenReturn(-1);
      assertEquals(0.0, registry.get("jetty.threads.utilization.ratio").gauge().value());
    } finally {
      registry.close();
    }
  }
}
