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

package org.openmetadata.service.alerting.channel;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * What one alert's delivery remembers and the next must not: the targets whose connection failed.
 * A delivery runs on one thread from start to end, so publishers reach the memory of the delivery
 * they are part of without every one of them being handed it, and a thread that sends on its
 * behalf adopts it. Outside a delivery nothing is remembered.
 */
public final class DeliveryMemory {

  private static final ThreadLocal<DeliveryMemory> OF_THIS_THREAD = new ThreadLocal<>();

  // Several of one event's targets may be sent to at the same time, each on a thread of its own.
  private final Set<Object> unreachableTargets = ConcurrentHashMap.newKeySet();

  private DeliveryMemory() {}

  public static void begin() {
    OF_THIS_THREAD.set(new DeliveryMemory());
  }

  public static void end() {
    OF_THIS_THREAD.remove();
  }

  /** The memory of the delivery running on this thread, for a thread that sends on its behalf. */
  public static DeliveryMemory current() {
    return OF_THIS_THREAD.get();
  }

  public static void adopt(DeliveryMemory ofTheDelivery) {
    OF_THIS_THREAD.set(ofTheDelivery);
  }

  public static boolean isUnreachable(Object target) {
    DeliveryMemory memory = OF_THIS_THREAD.get();
    return memory != null && memory.unreachableTargets.contains(target);
  }

  public static void rememberUnreachable(Object target) {
    DeliveryMemory memory = OF_THIS_THREAD.get();
    if (memory != null) {
      memory.unreachableTargets.add(target);
    }
  }
}
