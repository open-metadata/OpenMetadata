import { EntityTags } from 'Models';
import { Dbtmodel } from '../../generated/entity/data/dbtmodel';
import { EntityReference } from '../../generated/entity/data/table';
import { User } from '../../generated/entity/teams/user';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';

export interface DatasetOwner extends EntityReference {
  displayName?: string;
}

export interface DBTModelDetailsProps {
  version?: string;
  users: Array<User>;
  dbtModelDetails: Dbtmodel;
  dbtModelFQN: string;
  entityName: string;
  activeTab: number;
  owner: DatasetOwner;
  description: string;
  tier: string;
  columns: Dbtmodel['columns'];
  followers: Array<User>;
  dbtModelTags: Array<EntityTags>;
  slashedDBTModelName: TitleBreadcrumbProps['titleLinks'];
  viewDefinition: Dbtmodel['viewDefinition'];
  setActiveTabHandler: (value: number) => void;
  followDBTModelHandler: () => void;
  unfollowDBTModelHandler: () => void;
  settingsUpdateHandler: (updatedDBTModel: Dbtmodel) => Promise<void>;
  columnsUpdateHandler: (updatedDBTModel: Dbtmodel) => void;
  descriptionUpdateHandler: (updatedDBTModel: Dbtmodel) => void;
}
