/*
 *  Copyright 2025 Collate.
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
import {
  MAX_LATENCY_UNITS,
  REFRESH_FREQUENCY_UNITS,
  RETENTION_UNITS,
} from '../../../constants/DataContract.constants';
import {
  ContractSLA,
  Timezone,
} from '../../../generated/entity/data/dataContract';
import {
  SlaFormValues,
  toContractSla,
  toSlaFormValues,
} from './ContractSLAFormTab.utils';

const units = {
  max_latency_unit: MAX_LATENCY_UNITS[0] as SlaFormValues['max_latency_unit'],
  refresh_frequency_unit:
    REFRESH_FREQUENCY_UNITS[0] as SlaFormValues['refresh_frequency_unit'],
  retention_unit: RETENTION_UNITS[0] as SlaFormValues['retention_unit'],
};

describe('SLA form serialization', () => {
  it('round-trips wall-clock time and zero-valued durations', () => {
    const sla = toContractSla({
      ...units,
      availabilityTime: { hour: 9, minute: 3 },
      max_latency_value: 0,
      refresh_frequency_interval: 0,
      retention_period: 0,
      columnName: 'updatedAt',
    });

    expect(sla.availabilityTime).toBe('09:03');
    expect(sla.maxLatency?.value).toBe(0);
    expect(sla.refreshFrequency?.interval).toBe(0);
    expect(sla.retention?.period).toBe(0);
    expect(toContractSla(toSlaFormValues(sla))).toEqual(sla);
  });

  it('omits cleared values even when a unit remains selected', () => {
    expect(
      toContractSla({
        ...units,
        availabilityTime: null,
        max_latency_value: null,
        refresh_frequency_interval: null,
        retention_period: null,
      })
    ).toEqual({});
  });

  it('omits negative or nonfinite durations', () => {
    expect(
      toContractSla({
        ...units,
        max_latency_value: -1,
        refresh_frequency_interval: NaN,
        retention_period: Infinity,
      })
    ).toEqual({});
  });

  it('handles absent initial SLA fields and retains an explicit timezone', () => {
    expect(toContractSla(toSlaFormValues())).toEqual({});

    const sla = {
      availabilityTime: '00:00',
      timezone: Timezone.GMT0000EuropeLondon,
    } as ContractSLA;

    expect(toContractSla(toSlaFormValues(sla))).toEqual(sla);
  });
});
