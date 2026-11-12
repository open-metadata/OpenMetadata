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
    Card,
    PageLayout,
    Table,
    Typography
} from '@openmetadata/ui-core-components';
import { Edit01 } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ClientErrors } from '../../../../enums/Axios.enum';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { Operation } from '../../../../generated/entity/policies/policy';
import {
    TestCaseParameterDefinition,
    TestDefinition
} from '../../../../generated/tests/testDefinition';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import { useFqn } from '../../../../hooks/useFqn';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';
import { checkPermission } from '../../../../utils/PermissionsUtils';
import NoDataPlaceholder from '../../../common/EmptyPlaceholder/NoDataPlaceholder';
import PermissionPlaceholder from '../../../common/EmptyPlaceholder/PermissionPlaceholder';
import SomethingWentWrongPlaceholder from '../../../common/EmptyPlaceholder/SomethingWentWrongPlaceholder';
import HeaderBreadcrumb from '../../../common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import Loader from '../../../common/Loader/Loader';
import RichTextEditorPreviewerNew from '../../../common/RichTextEditor/RichTextEditorPreviewNew';
import DataQualityTab from '../../../Database/Profiler/DataQualityTab/DataQualityTab';
import TestDefinitionForm from '../../../TestLibrary/TestDefinitionForm/TestDefinitionForm.component';
import { getObservabilityRootBreadcrumb } from '../../observabilityBreadcrumb.utils';
import ObservabilityPageShell from '../../ObservabilityPageShell/ObservabilityPageShell';
import { useTestDefinitionDetails } from './useTestDefinitionDetails';

const DetailItem = ({ label, value }: { label: string; value?: string }) => (
  <Box direction="col" gap={1}>
    <Typography as="dt" color="secondary" size="text-xs" weight="medium">
      {label}
    </Typography>
    <Typography as="dd" className="tw:m-0" size="text-sm">
      {value || '--'}
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
    <Card data-testid="test-definition-overview">
      <Card.Content>
        <Box direction="col" gap={4}>
          <RichTextEditorPreviewerNew
            markdown={testDefinition.description ?? ''}
          />
          <dl className="tw:m-0 tw:grid tw:grid-cols-2 tw:gap-4 tw:md:grid-cols-5">
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
              label={t('label.supported-data-type-plural')}
              value={testDefinition.supportedDataTypes?.join(', ')}
            />
            <DetailItem
              label={t('label.provider')}
              value={testDefinition.provider}
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
      </Card.Content>
    </Card>
  );
};

/**
 * Detail page for one test definition: what it checks and every test case
 * that uses it. Serves both the app-mode `/observability/test-library/:fqn`
 * route and the classic `/test-library/:fqn` route.
 */
const TestDefinitionDetailsPage = () => {
  const { t } = useTranslation();
  const { fqn } = useFqn();
  const { permissions } = usePermissionProvider();
  const [isFormVisible, setIsFormVisible] = useState(false);
  const viewPermission = checkPermission(
    Operation.ViewBasic,
    ResourceEntity.TEST_DEFINITION,
    permissions
  );
  const { canEditAll } = useEntityPermissions(
    ResourceEntity.TEST_DEFINITION,
    fqn,
    { enabled: viewPermission && Boolean(fqn) }
  );
  const {
    testDefinition,
    isDefinitionLoading,
    definitionError,
    refetchDefinition,
    testCases,
    entityPermissions,
    isTestCaseLoading,
    refetchTestCases,
    pagingData,
    showPagination,
  } = useTestDefinitionDetails(fqn, viewPermission);

  if (!viewPermission) {
    return (
      <div className="tw:relative tw:h-full tw:w-full tw:min-h-60">
        <PermissionPlaceholder
          permissionValue={t('label.view-entity', {
            entity: t('label.test-definition'),
          })}
        />
      </div>
    );
  }

  if (isDefinitionLoading) {
    return <Loader />;
  }

  if (
    definitionError &&
    (definitionError as AxiosError).response?.status !== ClientErrors.NOT_FOUND
  ) {
    return (
      <div className="tw:relative tw:h-full tw:w-full tw:min-h-60">
        <SomethingWentWrongPlaceholder />
      </div>
    );
  }

  if (!testDefinition) {
    return (
      <div className="tw:relative tw:h-full tw:w-full tw:min-h-60">
        <NoDataPlaceholder />
      </div>
    );
  }

  const title = getEntityName(testDefinition);
  const breadcrumbItems = [
    ...(observabilityRouterClassBase.isEmbeddedMode()
      ? [getObservabilityRootBreadcrumb(t)]
      : []),
    {
      label: t('label.test-library'),
      href: observabilityRouterClassBase.getTestLibraryPath(),
    },
    { label: title, ariaLabel: title },
  ];

  const handleFormSuccess = () => {
    setIsFormVisible(false);
    void refetchDefinition();
  };

  return (
    <>
      <ObservabilityPageShell
        header={
          <PageLayout.PageHeader
            actions={
              canEditAll ? (
                <Button
                  color="secondary"
                  data-testid="edit-test-definition-button"
                  iconLeading={Edit01}
                  size="md"
                  onPress={() => setIsFormVisible(true)}>
                  {t('label.edit')}
                </Button>
              ) : undefined
            }
            breadcrumb={
              <HeaderBreadcrumb
                noMargin
                className="tw:text-xs"
                items={breadcrumbItems}
                showHome={false}
              />
            }
            title={title}
            variant="gradient"
          />
        }
        pageTitle={title}>
        <Box direction="col" gap={4}>
          <TestDefinitionOverview testDefinition={testDefinition} />
          <Box direction="col" gap={2}>
            <Typography as="h3" size="text-md" weight="semibold">
              {t('label.test-case-plural')}
            </Typography>
            <DataQualityTab
              afterDeleteAction={refetchTestCases}
              entityPermissions={entityPermissions}
              isLoading={isTestCaseLoading}
              pagingData={pagingData}
              showPagination={showPagination}
              testCases={testCases}
              onTestCaseResultUpdate={refetchTestCases}
              onTestUpdate={refetchTestCases}
            />
          </Box>
        </Box>
      </ObservabilityPageShell>

      <TestDefinitionForm
        initialValues={testDefinition}
        open={isFormVisible}
        onCancel={() => setIsFormVisible(false)}
        onSuccess={handleFormSuccess}
      />
    </>
  );
};

export default TestDefinitionDetailsPage;
