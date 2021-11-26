import { Table } from '../../generated/entity/data/table';
import { EntityHistory } from '../../generated/type/entityHistory';
import { TagLabel } from '../../generated/type/tagLabel';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';

export interface DatasetVersionProp {
  version: string;
  currentVersionData: Table;
  isVersionLoading: boolean;
  owner: Table['owner'];
  tier: TagLabel;
  slashedTableName: TitleBreadcrumbProps['titleLinks'];
  datasetFQN: string;
  versionList: EntityHistory;
  backHandler: () => void;
  versionHandler: (v: string) => void;
}
