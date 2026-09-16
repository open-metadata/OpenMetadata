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
import { FormSelectItem } from '@openmetadata/ui-core-components';
import { UseFormReturn } from 'react-hook-form';
import { EntityReference } from '../../../generated/entity/type';

/**
 * Select/autocomplete option that carries a typed payload on `value`:
 * an `EntityReference` for the entity pickers (owners, reviewers, domains,
 * related metrics) and the raw enum string for the closed-list
 * selects (metric type, granularity, unit of measurement, language). The
 * pure transform reads `value` and never touches the options list.
 */
export interface MetricFormSelectItem extends FormSelectItem {
  value: EntityReference | string;
}

export interface MetricFormValues {
  name: string;
  displayName: string;
  description: string;
  metricType: MetricFormSelectItem | null;
  granularity: MetricFormSelectItem | null;
  unitOfMeasurement: MetricFormSelectItem | null;
  customUnitOfMeasurement: string;
  language: MetricFormSelectItem | null;
  code: string;
  metricGroup: string;
  isNewMetricGroup: boolean;
  owners: MetricFormSelectItem[];
  reviewers: MetricFormSelectItem[];
  domains: MetricFormSelectItem[];
  relatedMetrics: MetricFormSelectItem[];
}

export interface AddMetricFormProps {
  form: UseFormReturn<MetricFormValues>;
  parentMetricFqn?: string;
  onSubmit: (data: MetricFormValues) => void;
}
