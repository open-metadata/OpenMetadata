package org.openmetadata.service.jdbi3;

import java.util.ArrayDeque;
import java.util.Deque;

public final class ReadBundleContext {
  private static final ThreadLocal<Deque<ReadBundle>> BUNDLES =
      ThreadLocal.withInitial(ArrayDeque::new);

  private ReadBundleContext() {}

  static void push(ReadBundle bundle) {
    BUNDLES.get().push(bundle);
  }

  static ReadBundle getCurrent() {
    Deque<ReadBundle> stack = BUNDLES.get();
    return stack.isEmpty() ? null : stack.peek();
  }

  static void pop() {
    Deque<ReadBundle> stack = BUNDLES.get();
    if (!stack.isEmpty()) {
      stack.pop();
    }
    if (stack.isEmpty()) {
      BUNDLES.remove();
    }
  }

  public static void clear() {
    BUNDLES.remove();
  }
}
