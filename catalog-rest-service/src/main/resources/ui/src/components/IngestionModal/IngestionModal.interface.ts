interface ServiceData {
  serviceType: string;
  name: string;
}

interface ConnectorConfig {
  username: string;
  password: string;
  host: string;
  database: string;
  includeFilterPattern: Array<string>;
  excludeFilterPattern: Array<string>;
  includeViews: boolean;
  excludeDataProfiler: boolean;
}

export interface IngestionModalProps {
  header: string;
  name?: string;
  service?: string;
  serviceList: Array<ServiceData>;
  type?: string;
  schedule?: string;
  connectorConfig?: ConnectorConfig;
  onSave: () => void;
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
}
