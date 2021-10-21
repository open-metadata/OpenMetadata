import { EntityTags } from 'Models';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import {
  Table,
  TableData,
  TableJoins,
  TypeUsedToReturnUsageDetailsOfAnEntity,
} from '../../generated/entity/data/table';
import { User } from '../../generated/entity/teams/user';
import { EntityLineage } from '../../generated/type/entityLineage';
import { EntityReference } from '../../generated/type/entityReference';

interface DatasetOwner extends EntityReference {
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
  setActiveTabHandler: (value: number) => void;
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
  followTableHandler: () => void;
  unfollowTableHandler: () => void;
  settingsUpdateHandler: (updatedTable: Table) => Promise<void>;
  columnsUpdateHandler: (updatedTable: Table) => void;
  descriptionUpdateHandler: (updatedTable: Table) => void;
}
