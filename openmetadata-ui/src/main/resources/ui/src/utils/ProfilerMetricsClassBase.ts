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
import { PROFILER_METRIC } from '../constants/profiler.constant';

/**
 * Source of the metric names offered by the profiler settings modal's per-column metrics picker.
 * Extracted to a class so downstream distributions that ship additional profiler metrics can
 * extend this list without forking the modal itself.
 */
class ProfilerMetricsClassBase {
  public getProfilerMetricOptions(): string[] {
    return PROFILER_METRIC;
  }
}

const profilerMetricsClassBase = new ProfilerMetricsClassBase();

export default profilerMetricsClassBase;
export { ProfilerMetricsClassBase };
