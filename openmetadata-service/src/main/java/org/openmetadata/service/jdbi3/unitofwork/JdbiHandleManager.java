package org.openmetadata.service.jdbi3.unitofwork;

import java.util.concurrent.ThreadFactory;
import org.jdbi.v3.core.Handle;

public interface JdbiHandleManager {
  Handle get();

  void clear();

  default ThreadFactory createThreadFactory() {
    throw new UnsupportedOperationException("Thread factory creation is not supported");
  }

  default String getConversationId() {
    return String.valueOf(Thread.currentThread().getId());
  }
}
