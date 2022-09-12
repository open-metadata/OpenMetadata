import { ExtraInfo } from 'Models';
import { TestSuite } from '../../generated/tests/testSuite';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';
import { OperationPermission } from '../PermissionProvider/PermissionProvider.interface';

export interface TestSuiteDetailsProps {
  permissions: OperationPermission;
  extraInfo: ExtraInfo[];
  slashedBreadCrumb: TitleBreadcrumbProps['titleLinks'];
  handleDeleteWidgetVisible: (isVisible: boolean) => void;
  isDeleteWidgetVisible: boolean;
  isTagEditable?: boolean;
  isDescriptionEditable: boolean;
  testSuite: TestSuite | undefined;
  handleUpdateOwner: (updatedOwner: TestSuite['owner']) => void;
  testSuiteDescription: string | undefined;
  descriptionHandler: (value: boolean) => void;
  handleDescriptionUpdate: (updatedHTML: string) => Promise<void>;
}
