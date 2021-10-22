import { EntityTags } from 'Models';
import {
  EntityReference,
  Table,
  TableData,
  TableJoins,
  TypeUsedToReturnUsageDetailsOfAnEntity,
} from '../../generated/entity/data/table';
import { User } from '../../generated/entity/teams/user';
import { EntityLineage } from '../../generated/type/entityLineage';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';

export interface DatasetOwner extends EntityReference {
  displayName?: string;
}

export interface DatasetDetailsProps {
  joins: TableJoins;
  usageSummary: TypeUsedToReturnUsageDetailsOfAnEntity;
  users: Array<User>;
  tableDetails: Table;
  entityName: string;
  datasetFQN: string;
  activeTab: number;
  owner: DatasetOwner;
  description: string;
  tableProfile: Table['tableProfile'];
  columns: Table['columns'];
  tier: string;
  sampleData: TableData;
  entityLineage: EntityLineage;
  followers: Array<User>;
  tableTags: Array<EntityTags>;
  slashedTableName: TitleBreadcrumbProps['titleLinks'];
  setActiveTabHandler: (value: number) => void;
  followTableHandler: () => void;
  unfollowTableHandler: () => void;
  settingsUpdateHandler: (updatedTable: Table) => Promise<void>;
  columnsUpdateHandler: (updatedTable: Table) => void;
  descriptionUpdateHandler: (updatedTable: Table) => void;
}
