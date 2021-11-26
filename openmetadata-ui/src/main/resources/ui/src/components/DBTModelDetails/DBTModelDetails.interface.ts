import { EntityTags } from 'Models';
import { Dbtmodel } from '../../generated/entity/data/dbtmodel';
import { EntityReference } from '../../generated/entity/data/table';
import { User } from '../../generated/entity/teams/user';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';

export interface DatasetOwner extends EntityReference {
  displayName?: string;
}

export interface DatasetDetailsProps {
  version?: string;
  users: Array<User>;
  dbtModelDetails: Dbtmodel;
  dbtModelFQN: string;
  entityName: string;
  activeTab: number;
  owner: DatasetOwner;
  description: string;
  columns: Dbtmodel['columns'];
  followers: Array<User>;
  tableTags: Array<EntityTags>;
  slashedTableName: TitleBreadcrumbProps['titleLinks'];
  setActiveTabHandler: (value: number) => void;
  followTableHandler: () => void;
  unfollowTableHandler: () => void;
  settingsUpdateHandler: (updatedTable: Dbtmodel) => Promise<void>;
  columnsUpdateHandler: (updatedTable: Dbtmodel) => void;
  descriptionUpdateHandler: (updatedTable: Dbtmodel) => void;
}
