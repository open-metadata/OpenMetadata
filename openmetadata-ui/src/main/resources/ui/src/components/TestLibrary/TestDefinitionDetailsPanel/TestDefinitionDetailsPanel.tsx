/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import {
  Box,
  Button,
  SlideoutMenu,
  Table,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit01 } from '@openmetadata/ui-core-components/icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import {
  TestCaseParameterDefinition,
  TestDefinition,
} from '../../../generated/tests/testDefinition';
import { getEntityName } from '../../../utils/EntityNameUtils';
import SomethingWentWrongPlaceholder from '../../common/EmptyPlaceholder/SomethingWentWrongPlaceholder';
import RichTextEditorPreviewerNew from '../../common/RichTextEditor/RichTextEditorPreviewNew';
import DataQualityTab from '../../Database/Profiler/DataQualityTab/DataQualityTab';
import { useTestDefinitionTestCases } from './useTestDefinitionTestCases';

export interface TestDefinitionDetailsPanelProps {
  /** The definition to show; the panel is closed while this is undefined. */
  testDefinition?: TestDefinition;
  canEdit: boolean;
  onEdit: (testDefinition: TestDefinition) => void;
  onClose: () => void;
}

const DetailItem = ({
  className,
  label,
  value,
}: {
  className?: string;
  label: string;
  value?: string;
}) => (
  <Box className={className} direction="col" gap={1}>
    <Typography as="dt" color="secondary" size="text-xs" weight="medium">
      {label}
    </Typography>
    <Typography as="dd" className="tw:m-0" size="text-sm">
      {value || NO_DATA_PLACEHOLDER}
    </Typography>
  </Box>
);

const TestDefinitionOverview = ({
  testDefinition,
}: {
  testDefinition: TestDefinition;
}) => {
  const { t } = useTranslation();
  const parameterColumns = useMemo(
    () => [
      { id: 'name', label: t('label.name') },
      { id: 'dataType', label: t('label.data-type') },
      { id: 'required', label: t('label.required') },
      { id: 'description', label: t('label.description') },
    ],
    [t]
  );

  return (
    <Box data-testid="test-definition-overview" direction="col" gap={4}>
      <RichTextEditorPreviewerNew markdown={testDefinition.description ?? ''} />
      <dl className="tw:m-0 tw:grid tw:grid-cols-2 tw:gap-4 tw:md:grid-cols-4">
        <DetailItem
          label={t('label.entity-type')}
          value={testDefinition.entityType}
        />
        <DetailItem
          label={t('label.test-platform-plural')}
          value={testDefinition.testPlatforms?.join(', ')}
        />
        <DetailItem
          label={t('label.data-quality-dimension')}
          value={testDefinition.dataQualityDimension}
        />
        <DetailItem
          label={t('label.provider')}
          value={testDefinition.provider}
        />
        <DetailItem
          className="tw:col-span-full"
          label={t('label.supported-data-type-plural')}
          value={testDefinition.supportedDataTypes?.join(', ')}
        />
      </dl>
      {Boolean(testDefinition.parameterDefinition?.length) && (
        <Table
          aria-label={t('label.parameter-plural')}
          data-testid="test-definition-parameters"
          size="sm">
          <Table.Header columns={parameterColumns}>
            {(col) => (
              <Table.Head
                id={col.id}
                isRowHeader={col.id === 'name'}
                key={col.id}
                label={col.label}
              />
            )}
          </Table.Header>
          <Table.Body items={testDefinition.parameterDefinition}>
            {(param: TestCaseParameterDefinition) => (
              <Table.Row id={param.name} key={param.name}>
                <Table.Cell>{getEntityName(param)}</Table.Cell>
                <Table.Cell>{param.dataType}</Table.Cell>
                <Table.Cell>
                  {param.required ? t('label.yes') : t('label.no')}
                </Table.Cell>
                <Table.Cell>
                  <RichTextEditorPreviewerNew
                    markdown={param.description ?? ''}
                  />
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table>
      )}
    </Box>
  );
};

/**
 * Side panel for one test definition, opened from its name in the Test
 * Library: what it checks and every test case that uses it. Shared by the
 * classic and AI-mode Test Library pages.
 */
const TestDefinitionDetailsPanel = ({
  testDefinition,
  canEdit,
  onEdit,
  onClose,
}: TestDefinitionDetailsPanelProps) => {
  const { t } = useTranslation();
  const {
    testCases,
    entityPermissions,
    isError,
    isLoading,
    showPagination,
    pagingData,
    refetchTestCases,
  } = useTestDefinitionTestCases(testDefinition?.fullyQualifiedName);

  return (
    <SlideoutMenu
      isDismissable
      aria-label={t('label.test-definition')}
      data-testid="test-definition-details-panel"
      isOpen={Boolean(testDefinition)}
      width={1040}
      onOpenChange={(isOpen) => !isOpen && onClose()}>
      {({ close }) =>
        testDefinition && (
          <>
            <SlideoutMenu.Header
              className="tw:border-b tw:border-secondary tw:pb-4"
              onClose={close}>
              <Box align="center" className="tw:pr-8" gap={3} justify="between">
                {/* not-prose: Typography wraps a heading in .prose, whose h2
                    style would replace the size given here. */}
                <Typography
                  as="h2"
                  className="not-prose tw:min-w-0 tw:text-primary"
                  data-testid="test-definition-details-name"
                  size="text-md"
                  weight="medium">
                  {getEntityName(testDefinition)}
                </Typography>
                {canEdit && (
                  <Button
                    color="secondary"
                    data-testid="edit-test-definition-button"
                    iconLeading={Edit01}
                    size="sm"
                    onPress={() => onEdit(testDefinition)}>
                    {t('label.edit')}
                  </Button>
                )}
              </Box>
            </SlideoutMenu.Header>
            <SlideoutMenu.Content className="tw:pb-6">
              <Box direction="col" gap={6}>
                <TestDefinitionOverview testDefinition={testDefinition} />
                <Box direction="col" gap={2}>
                  <Typography as="h3" size="text-md" weight="semibold">
                    {t('label.test-case-plural')}
                  </Typography>
                  {isError ? (
                    <div className="tw:relative tw:min-h-60 tw:w-full">
                      <SomethingWentWrongPlaceholder />
                    </div>
                  ) : (
                    <DataQualityTab
                      afterDeleteAction={refetchTestCases}
                      entityPermissions={entityPermissions}
                      isLoading={isLoading}
                      pagingData={pagingData}
                      showPagination={showPagination}
                      testCases={testCases}
                      onTestCaseResultUpdate={refetchTestCases}
                      onTestUpdate={refetchTestCases}
                    />
                  )}
                </Box>
              </Box>
            </SlideoutMenu.Content>
          </>
        )
      }
    </SlideoutMenu>
  );
};

export default TestDefinitionDetailsPanel;
