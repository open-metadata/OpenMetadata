import { IngestionType } from '../../enums/service.enum';
import { DatabaseService } from '../../generated/entity/services/databaseService';
import { EntityReference } from '../../generated/type/entityReference';

export interface IngestionData {
  id: string;
  name: string;
  displayName: string;
  type: IngestionType;
  service: EntityReference;
  scheduleInterval: string;
  ingestionStatuses: Array<{
    state: string;
    startDate: string;
    endDate: string;
  }>;
  nextExecutionDate?: string;
}

export interface Props {
  ingestionList: Array<IngestionData>;
  serviceList: Array<DatabaseService>;
  deleteIngestion: (id: string, displayName: string) => Promise<void>;
  triggerIngestion: (id: string, displayName: string) => Promise<void>;
}
