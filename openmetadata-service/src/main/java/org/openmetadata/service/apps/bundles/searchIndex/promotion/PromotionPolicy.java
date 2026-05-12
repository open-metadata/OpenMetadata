/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.apps.bundles.searchIndex.promotion;

/**
 * Decides whether a per-entity reindex was "fully successful". The default implementation,
 * {@link RatioPromotionPolicy}, declares success when the per-record success ratio clears a
 * configurable threshold. Promotion itself remains unconditional — {@code DefaultRecreateHandler}
 * always promotes a non-empty staged index via the existing doc-count rescue when this flag is
 * false. The flag drives the operator-visible "did this entity run cleanly?" signal.
 *
 * <p>Prior to this abstraction the strict rule was binary ("zero failures") and the rescue lived
 * unannounced inside the handler. Centralizing the success threshold here makes it tunable and
 * makes the rescue's existence explicit in the contract.
 */
public interface PromotionPolicy {

  Decision evaluate(EntityPromotionContext context);

  /**
   * Outcome of {@link #evaluate(EntityPromotionContext)}.
   *
   * @param fullySuccessful true if the entity reindex met the policy's strict success bar;
   *     false if the rescue path (doc-count fallback in
   *     {@code DefaultRecreateHandler.promoteEntityIndex}) must decide whether the staged index
   *     is salvageable. Promotion is always attempted regardless of this flag — the flag
   *     controls how the run is logged / reported.
   * @param reason human-readable rationale for the audit log
   */
  record Decision(boolean fullySuccessful, String reason) {}
}
