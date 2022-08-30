import { ExtraInfo } from 'Models';
import { TestSuite } from '../../generated/tests/testSuite';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';

export interface TestSuiteDetailsProps {
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
  handleDescriptionUpdate: (updatedHTML: string) => void;
}
