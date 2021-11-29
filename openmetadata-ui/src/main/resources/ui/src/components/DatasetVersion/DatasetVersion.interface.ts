import { Table } from '../../generated/entity/data/table';
import { EntityHistory } from '../../generated/type/entityHistory';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';

export interface DatasetVersionProp {
  version: string;
  currentVersionData: Table;
  isVersionLoading: boolean;
  owner: Table['owner'];
  tier: string;
  slashedTableName: TitleBreadcrumbProps['titleLinks'];
  datasetFQN: string;
  versionList: EntityHistory;
  backHandler: () => void;
  versionHandler: (v: string) => void;
}
