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
