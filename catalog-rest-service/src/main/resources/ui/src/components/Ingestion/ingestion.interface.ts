import { Operation } from 'fast-json-patch';
import { Paging } from 'Models';
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
  owner?: { id: string; name?: string; type: string };
  startDate?: string;
  endDate?: string;
}

export interface Props {
  paging: Paging;
  ingestionList: Array<IngestionData>;
  serviceList: Array<DatabaseService>;
  pagingHandler: (value: string) => void;
  deleteIngestion: (id: string, displayName: string) => Promise<void>;
  triggerIngestion: (id: string, displayName: string) => Promise<void>;
  addIngestion: (data: IngestionData, triggerIngestion?: boolean) => void;
  updateIngestion: (
    id: string,
    displayName: string,
    patch: Array<Operation>,
    triggerIngestion?: boolean
  ) => Promise<void>;
}
