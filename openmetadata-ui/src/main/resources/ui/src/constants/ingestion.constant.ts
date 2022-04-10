/*
 *  Copyright 2021 Collate
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

import { StepperStepType } from 'Models';
import { PatternType } from '../components/AddIngestion/addIngestion.interface';

export const STEPS_FOR_ADD_INGESTION: Array<StepperStepType> = [
  { name: 'Configure Ingestion', step: 1 },
  { name: 'Schedule Interval', step: 2 },
];

export const INGESTION_SCHEDULER_INITIAL_VALUE = '5 * * * *';

export const INITIAL_FILTER_PATTERN: PatternType = {
  include: [],
  exclude: [],
};
