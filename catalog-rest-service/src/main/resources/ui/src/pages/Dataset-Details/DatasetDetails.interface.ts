import { ColumnTags } from 'Models';
import { Dispatch, SetStateAction } from 'react';
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

export interface DatasetOwner extends EntityReference {
  displayName?: string;
}

export interface DatasetDetailsProps {
  joins: TableJoins;
  isLoading: boolean;
  usageSummary: TypeUsedToReturnUsageDetailsOfAnEntity;
  users: Array<User>;
  tableDetails: Table;
  entityName: string;
  datasetFQN: string;
  activeTab: number;
  setActiveTab: Dispatch<SetStateAction<number>>;
  owner: DatasetOwner;
  description: string;
  tableProfile: Table['tableProfile'];
  columns: Table['columns'];
  tier: string;
  sampleData: TableData;
  entityLineage: EntityLineage;
  followers: Array<User>;
  tableTags: Array<ColumnTags>;
  slashedTableName: TitleBreadcrumbProps['titleLinks'];
  followTableHandler: () => void;
  unfollowTableHandler: () => void;
  settingsUpdateHandler: (updatedTable: Table) => Promise<void>;
  columnsUpdateHandler: (updatedTable: Table) => void;
  descriptionUpdateHandler: (updatedTable: Table) => void;
}
