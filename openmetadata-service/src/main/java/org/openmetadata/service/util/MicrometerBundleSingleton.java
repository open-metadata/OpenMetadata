package org.openmetadata.service.util;

import io.dropwizard.metrics.micrometer.MicrometerBundle;
import io.micrometer.core.instrument.Clock;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.binder.jvm.ClassLoaderMetrics;
import io.micrometer.core.instrument.binder.jvm.JvmGcMetrics;
import io.micrometer.core.instrument.binder.jvm.JvmMemoryMetrics;
import io.micrometer.core.instrument.binder.jvm.JvmThreadMetrics;
import io.micrometer.core.instrument.binder.system.ProcessorMetrics;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

public class MicrometerBundleSingleton {
    private static final MicrometerBundle INSTANCE = createMicrometerBundle();

    private MicrometerBundleSingleton() {}

    public static MicrometerBundle getInstance() {
        return INSTANCE;
    }

    public static MicrometerBundle createMicrometerBundle() {
        MeterRegistry registry = new SimpleMeterRegistry();
        new ClassLoaderMetrics().bindTo(registry);
        new JvmMemoryMetrics().bindTo(registry);
        new JvmGcMetrics().bindTo(registry);
        new ProcessorMetrics().bindTo(registry);
        new JvmThreadMetrics().bindTo(registry);

        return new MicrometerBundle(registry, Clock.SYSTEM);
    }
}
