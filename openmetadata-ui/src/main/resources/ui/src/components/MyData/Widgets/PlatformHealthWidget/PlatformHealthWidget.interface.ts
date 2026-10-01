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

import type { IngestionPipelineStats } from './useIngestionPipelineStats';

/**
 * Props handed to the optional insight block rendered at the bottom of the
 * Platform Health card.
 *
 * The block itself is supplied by the deployment, not by OSS — see
 * `CustomizeMyDataPageClassBase.getPlatformHealthInsight()`. OSS ships no
 * implementation, so the card renders without it; Collate supplies one that
 * summarises the failing services with an agent. Everything the block needs is
 * already fetched by the card, so it never issues its own health request.
 */
export interface PlatformHealthInsightProps
  extends Pick<
    IngestionPipelineStats,
    | 'connectedServices'
    | 'failedServices'
    | 'failingServices'
    | 'healthyServices'
    | 'pendingServices'
    | 'isLoading'
    | 'isError'
  > {
  /** Nothing is failing — the block should say so rather than explain a fault. */
  isHealthy: boolean;
}
