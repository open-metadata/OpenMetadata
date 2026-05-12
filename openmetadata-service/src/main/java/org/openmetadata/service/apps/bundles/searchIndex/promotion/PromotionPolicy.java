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
 * Decides whether a staged index should replace the live index given the entity's record-level
 * success / failure counts. The default implementation is {@link RatioPromotionPolicy}, which
 * promotes when the per-record success ratio clears a configurable threshold.
 *
 * <p>Prior to this abstraction the rule was binary ("zero failures") and a doc-count > 0 check in
 * {@code DefaultRecreateHandler} acted as a hidden rescue. Centralizing the decision in one place
 * keeps the contract explicit and lets us tune sensitivity per-deployment.
 */
public interface PromotionPolicy {

  Decision evaluate(EntityPromotionContext context);

  /** Promotion decision plus a human-readable reason for the audit log. */
  record Decision(boolean promote, String reason) {}
}
