import { IngestionType } from '../../enums/service.enum';
import { DatabaseService } from '../../generated/entity/services/databaseService';
import { EntityReference } from '../../generated/type/entityReference';

export interface ConnectorConfig {
  username: string;
  password: string;
  host: string;
  database: string;
  includeFilterPattern: Array<string>;
  excludeFilterPattern: Array<string>;
  includeViews: boolean;
  excludeDataProfiler?: boolean;
  enableDataProfiler?: boolean;
}
export interface IngestionData {
  id?: string;
  name: string;
  displayName: string;
  ingestionType: IngestionType;
  service: EntityReference;
  scheduleInterval: string;
  ingestionStatuses?: Array<{
    state: string;
    startDate: string;
    endDate: string;
  }>;
  nextExecutionDate?: string;
  connectorConfig?: ConnectorConfig;
  forceDeploy?: boolean;
}

export interface Props {
  ingestionList: Array<IngestionData>;
  serviceList: Array<DatabaseService>;
  deleteIngestion: (id: string, displayName: string) => Promise<void>;
  triggerIngestion: (id: string, displayName: string) => Promise<void>;
  addIngestion: (data: IngestionData) => void;
}
