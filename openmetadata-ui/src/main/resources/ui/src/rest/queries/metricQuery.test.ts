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
import { METRIC_DEFAULT_FIELDS } from './metricQuery';

describe('METRIC_DEFAULT_FIELDS', () => {
  it('requests every relationship needed by the metric Overview', () => {
    const fields = METRIC_DEFAULT_FIELDS.split(',');

    expect(fields).toEqual(
      expect.arrayContaining([
        'children',
        'childrenCount',
        'domains',
        'extension',
        'experts',
        'followers',
        'metricGroup',
        'owners',
        'parent',
        'relatedMetrics',
        'reviewers',
        'tags',
      ])
    );
    expect(fields).not.toContain('assets');
  });
});
