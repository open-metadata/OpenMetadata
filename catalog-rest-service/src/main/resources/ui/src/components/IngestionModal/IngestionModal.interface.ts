import {
  ConnectorConfig,
  IngestionData,
} from '../Ingestion/ingestion.interface';

interface ServiceData {
  serviceType: string;
  name: string;
}

export interface IngestionModalProps {
  ingestionList: Array<IngestionData>;
  header: string;
  name?: string;
  service?: string;
  serviceList: Array<ServiceData>;
  type?: string;
  schedule?: string;
  connectorConfig?: ConnectorConfig;
  addIngestion: (data: IngestionData) => void;
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
