/*
 *  Copyright 2024 Collate.
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

import { type FC } from 'react';
import MetricListHeader, {
  MetricListHeaderProps,
} from './MetricListHeader';

/**
 * Extension point for the Metric list page header. OSS default is the plain
 * title + actions row; Collate overrides `getHeader` (via
 * `MetricListPageClassCollate`, wired by the class-replacement Vite plugin)
 * to wrap it in the gradient header. Keeps the shared page differing between
 * Collate and OSS without a fork.
 */
class MetricListPageClassBase {
  public getHeader(): FC<MetricListHeaderProps> {
    return MetricListHeader;
  }
}

const metricListPageClassBase = new MetricListPageClassBase();

export default metricListPageClassBase;

export { MetricListPageClassBase };
