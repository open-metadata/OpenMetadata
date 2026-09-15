package org.openmetadata.service.entity.read;

import java.util.ArrayDeque;
import java.util.Deque;

public final class ReadBundleContext {
  private static final ThreadLocal<Deque<ReadBundle>> BUNDLES =
      ThreadLocal.withInitial(ArrayDeque::new);

  private ReadBundleContext() {}

  public static void push(ReadBundle bundle) {
    BUNDLES.get().push(bundle);
  }

  public static ReadBundle getCurrent() {
    Deque<ReadBundle> stack = BUNDLES.get();
    return stack.isEmpty() ? null : stack.peek();
  }

  public static void pop() {
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
