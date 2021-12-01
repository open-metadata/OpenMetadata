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

import React from 'react';
import {
  ConnectorConfig,
  IngestionData,
} from '../Ingestion/ingestion.interface';

export interface ServiceData {
  serviceType: string;
  name: string;
}

export interface IngestionModalProps {
  isUpdating?: boolean;
  ingestionList: Array<IngestionData>;
  header: string | React.ReactNode;
  name?: string;
  service?: string;
  serviceList: Array<ServiceData>;
  type?: string;
  schedule?: string;
  connectorConfig?: ConnectorConfig;
  selectedIngestion?: IngestionData;
  addIngestion?: (data: IngestionData, triggerIngestion?: boolean) => void;
  updateIngestion?: (data: IngestionData, triggerIngestion?: boolean) => void;
  onCancel: () => void;
}

export interface ValidationErrorMsg {
  selectService: boolean;
  name: boolean;
  username: boolean;
  password: boolean;
  ingestionType: boolean;
  host: boolean;
  database: boolean;
  ingestionSchedule: boolean;
  isPipelineExists: boolean;
  isPipelineNameExists: boolean;
}
