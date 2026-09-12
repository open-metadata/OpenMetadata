import { EntityTags } from 'Models';
import { ReactNode } from 'react';
import { DataProduct } from '../../../../generated/entity/domains/dataProduct';
import {
  TagLabel,
  TestCase,
  TestCaseParameterValue,
} from '../../../../generated/tests/testCase';
import { TestDefinition } from '../../../../generated/tests/testDefinition';
import { ChangeSummaryEntry } from '../../../../rest/changeSummaryAPI';
import { ConfigurationParameterRow } from './TestCaseConfigurationCard/TestCaseConfigurationCard.types';

export interface TestCaseSidePanelProps {
  testCaseData: TestCase | undefined;
  testDefinition: TestDefinition | undefined;
  parameterRows: ConfigurationParameterRow[];
  withSqlParams: TestCaseParameterValue[];
  versionParameterDiff?: ReactNode;
  showEditParameterButton: boolean;
  onEditParameter: () => void;
  description: string | undefined;
  descriptionChangeSummaryEntry: ChangeSummaryEntry | undefined;
  hasEditDescriptionPermission: boolean | undefined;
  handleDescriptionChange: (updatedDescription: string) => Promise<void>;
  hasEditTagsPermission: boolean | undefined;
  hasEditGlossaryTermsPermission: boolean | undefined;
  updatedTags: TagLabel[];
  handleTagSelection: (selectedTags: EntityTags[]) => Promise<void>;
  isVersionPage: boolean;
  hasEditPermission: boolean | undefined;
  isRulesLoaded: boolean;
  requireDomainForDataProduct: boolean | undefined;
  handleDataProductsSave: (dataProducts: DataProduct[]) => Promise<void>;
}
