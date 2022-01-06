package org.openmetadata.catalog.events;

import com.lmax.disruptor.EventHandler;
import com.lmax.disruptor.LifecycleAware;
import java.util.Map;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.catalog.type.ChangeEvent;

public interface EventPublisher extends EventHandler<EventPubSub.ChangeEventHolder>, LifecycleAware {
  void init(Map<String, Object> config, Jdbi jdbi);

  void publish(ChangeEvent event);

  void close();
}
