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
package org.openmetadata.service.governance.workflows.util;

import com.google.common.base.Suppliers;
import java.util.List;
import java.util.OptionalDouble;
import java.util.function.DoubleSupplier;
import java.util.function.Supplier;
import java.util.stream.DoubleStream;

/** Where an approval cycle begins when its tasks supersede one another. */
public final class ApprovalCycle {
  private ApprovalCycle() {}

  /**
   * The earliest of the triggering edit's base and the base each carried task recorded, so a task
   * that supersedes others lists everything since the oldest of them began, whichever run stored
   * its task first. A base that is not known (a run without a triggering version, or a task stored
   * before bases were recorded) is {@code unknownBase}, evaluated at most once.
   */
  public static double baseVersion(
      OptionalDouble triggeringBase, List<Object> carriedPayloads, DoubleSupplier unknownBase) {
    Supplier<Double> unknown = Suppliers.memoize(unknownBase::getAsDouble);
    DoubleStream carriedBases =
        carriedPayloads.stream()
            .mapToDouble(payload -> orUnknown(ChangePreviewUtils.cycleBaseOf(payload), unknown));
    return DoubleStream.concat(DoubleStream.of(orUnknown(triggeringBase, unknown)), carriedBases)
        .min()
        .orElseThrow();
  }

  private static double orUnknown(OptionalDouble base, Supplier<Double> unknown) {
    return base.orElseGet(unknown::get);
  }
}
