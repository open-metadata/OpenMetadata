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
  Language,
  Metric,
  MetricGranularity,
  MetricType,
  UnitOfMeasurement,
} from '../generated/entity/data/metric';

export const METRIC_DUMMY_DATA: Metric = {
  id: '2be869f2-a8c6-4781-89fa-df45d671e449',
  name: 'LTV',
  fullyQualifiedName: 'LTV',
  displayName: 'Lifetime Value',
  metricExpression: {
    language: Language.Python,
    code: 'def ltv(customer: Customer, orders: List[Order]):\n\tlifetime = customer.lifetime\n  ltv: float = sum([o.amount for o in orders if o.customer_id == customer.id])\n  \n  return ltv',
  },
  metricType: MetricType.Other,
  unitOfMeasurement: UnitOfMeasurement.Dollars,
  granularity: MetricGranularity.Quarter,
  relatedMetrics: [],
  version: 0.1,
  updatedAt: 1727366423816,
  updatedBy: 'teddy',
  owners: [],
  followers: [],
  tags: [],
  deleted: false,
  dataProducts: [],
  votes: {
    upVotes: 0,
    downVotes: 0,
    upVoters: [],
    downVoters: [],
  },
};
