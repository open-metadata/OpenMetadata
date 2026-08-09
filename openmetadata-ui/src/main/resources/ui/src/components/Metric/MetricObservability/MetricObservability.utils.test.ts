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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 */
import { AxiosError, AxiosHeaders } from 'axios';
import { ReasonCode } from '../../../generated/api/data/metricObservability';
import {
  getMetricDimensionLabelKey,
  getMetricIncidentSeverityLabel,
  getMetricObservabilityReasonLabelKey,
  getMetricResultBadgeColor,
  getMetricResultLabelKey,
  isMetricObservabilityPermissionError,
  isRedactedMetricAsset,
} from './MetricObservability.utils';

describe('MetricObservability utilities', () => {
  it('localizes known dimensions and reason codes while preserving dynamic dimensions', () => {
    expect(getMetricDimensionLabelKey('No_Dimension')).toBe(
      'label.no-dimension'
    );
    expect(getMetricDimensionLabelKey('Business rule')).toBeUndefined();
    expect(getMetricObservabilityReasonLabelKey(ReasonCode.Healthy)).toBe(
      'label.healthy'
    );
  });

  it('only treats authentication and authorization responses as permission errors', () => {
    const forbidden = new AxiosError(
      'forbidden',
      undefined,
      undefined,
      undefined,
      {
        config: { headers: new AxiosHeaders() },
        data: undefined,
        headers: {},
        status: 403,
        statusText: 'Forbidden',
      }
    );
    const unavailable = new AxiosError(
      'unavailable',
      undefined,
      undefined,
      undefined,
      {
        config: { headers: new AxiosHeaders() },
        data: undefined,
        headers: {},
        status: 503,
        statusText: 'Unavailable',
      }
    );

    expect(isMetricObservabilityPermissionError(forbidden)).toBe(true);
    expect(isMetricObservabilityPermissionError(unavailable)).toBe(false);
    expect(isMetricObservabilityPermissionError(new Error('network'))).toBe(
      false
    );
  });

  it('identifies redacted sources and maps every result family to a badge tone', () => {
    expect(isRedactedMetricAsset({ id: 'hidden', type: 'table' })).toBe(true);
    expect(
      isRedactedMetricAsset({ id: 'visible', name: 'orders', type: 'table' })
    ).toBe(false);
    expect(getMetricResultBadgeColor('passed')).toBe('success');
    expect(getMetricResultBadgeColor('aborted')).toBe('error');
    expect(getMetricResultBadgeColor('queued')).toBe('gray');
    expect(getMetricResultLabelKey('Passed')).toBe('label.passed');
    expect(getMetricResultLabelKey('Critical')).toBe('label.critical');
    expect(getMetricResultLabelKey('New')).toBe('label.new');
    expect(getMetricResultLabelKey('Ack')).toBe('label.acknowledged');
    expect(getMetricResultLabelKey('Assigned')).toBe('label.assigned');
    expect(getMetricResultLabelKey('Resolved')).toBe('label.resolved');
    expect(getMetricResultLabelKey('custom')).toBeUndefined();
  });

  it.each(['Severity1', 'Severity2', 'Severity3', 'Severity4', 'Severity5'])(
    'localizes backend incident severity %s',
    (severity) => {
      expect(
        getMetricIncidentSeverityLabel(
          ((key: string) => key) as never,
          severity
        )
      ).toBe(`label.severity ${severity.slice(-1)}`);
    }
  );
});
