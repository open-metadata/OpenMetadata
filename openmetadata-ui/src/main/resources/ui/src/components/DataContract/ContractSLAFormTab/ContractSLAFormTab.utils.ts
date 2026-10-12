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
import { TimePickerValue } from '@openmetadata/ui-core-components';
import { ContractSLA } from '../../../generated/entity/data/dataContract';

export interface SlaFormValues {
  availabilityTime?: TimePickerValue | null;
  timezone?: ContractSLA['timezone'];
  columnName?: string;
  max_latency_unit?: NonNullable<ContractSLA['maxLatency']>['unit'];
  max_latency_value?: number | null;
  refresh_frequency_interval?: number | null;
  refresh_frequency_unit?: NonNullable<ContractSLA['refreshFrequency']>['unit'];
  retention_period?: number | null;
  retention_unit?: NonNullable<ContractSLA['retention']>['unit'];
}

export const toSlaFormValues = (sla?: ContractSLA): SlaFormValues => {
  const [hour, minute] = sla?.availabilityTime?.split(':').map(Number) ?? [];

  return {
    availabilityTime: sla?.availabilityTime ? { hour, minute } : null,
    timezone: sla?.timezone,
    columnName: sla?.columnName,
    max_latency_unit: sla?.maxLatency?.unit,
    max_latency_value: sla?.maxLatency?.value,
    refresh_frequency_interval: sla?.refreshFrequency?.interval,
    refresh_frequency_unit: sla?.refreshFrequency?.unit,
    retention_period: sla?.retention?.period,
    retention_unit: sla?.retention?.unit,
  };
};

const isNonnegative = (value: number | null | undefined): value is number =>
  value != null && Number.isFinite(value) && value >= 0;

export const toContractSla = (values: SlaFormValues): ContractSLA => {
  const sla: ContractSLA = {};
  if (values.availabilityTime) {
    // Availability is a wall-clock HH:mm value, independent of its timezone selection.
    sla.availabilityTime =
      String(values.availabilityTime.hour).padStart(2, '0') +
      ':' +
      String(values.availabilityTime.minute).padStart(2, '0');
  }
  if (values.timezone) {
    sla.timezone = values.timezone;
  }
  if (values.columnName) {
    sla.columnName = values.columnName;
  }
  // A cleared numeric field is null; it must not become a zero-valued SLA.
  if (values.max_latency_unit && isNonnegative(values.max_latency_value)) {
    sla.maxLatency = {
      unit: values.max_latency_unit,
      value: values.max_latency_value,
    };
  }
  if (
    values.refresh_frequency_unit &&
    isNonnegative(values.refresh_frequency_interval)
  ) {
    sla.refreshFrequency = {
      unit: values.refresh_frequency_unit,
      interval: values.refresh_frequency_interval,
    };
  }
  if (values.retention_unit && isNonnegative(values.retention_period)) {
    sla.retention = {
      unit: values.retention_unit,
      period: values.retention_period,
    };
  }

  return sla;
};
