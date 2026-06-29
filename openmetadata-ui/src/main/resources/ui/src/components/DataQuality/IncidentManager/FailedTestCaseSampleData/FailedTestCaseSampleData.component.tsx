/*
 *  Copyright 2025 Collate.
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

import { Table, Typography } from '@openmetadata/ui-core-components';
import { Button, Dropdown, Space, Tooltip } from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { ReactComponent as IconDelete } from '../../../../assets/svg/ic-delete.svg';
import { ReactComponent as IconDropdown } from '../../../../assets/svg/menu.svg';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../../enums/entity.enum';
import { Operation } from '../../../../generated/entity/policies/policy';
import { TableData } from '../../../../generated/tests/testCase';
import { TestCasePageTabs } from '../../../../pages/IncidentManager/IncidentManager.interface';
import {
  deleteTestCaseFailedSampleData,
  getTestCaseFailedSampleData,
} from '../../../../rest/testAPI';
import { getEntityDeleteMessage } from '../../../../utils/EntityDisplayPureUtils';
import { getColumnNameFromEntityLink } from '../../../../utils/EntityPureUtils';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';
import { checkPermission } from '../../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import Loader from '../../../common/Loader/Loader';
import { ManageButtonItemLabel } from '../../../common/ManageButtonContentItem/ManageButtonContentItem.component';
import { RowData } from '../../../Database/SampleDataTable/RowData';
import { SampleDataType } from '../../../Database/SampleDataTable/SampleData.interface';
import EntityDeleteModal from '../../../Modals/EntityDeleteModal/EntityDeleteModal';
import { FailedTestCaseSampleDataProps } from './FailedTestCaseSampleData.interface';

const DIFF_TYPE = 'diffType';
const ROW_KEY = '__rowKey';

const DIFF_TYPE_VALUES = {
  ADD: '+',
  REMOVE: '-',
  NOT_EQUAL: '!=',
};

type SampleDataColumn = {
  id: string;
  label: string;
};

type LocalSampleData = {
  columns: SampleDataColumn[];
  rows: Record<string, SampleDataType>[];
};

const FailedTestCaseSampleData = ({
  testCaseData,
}: FailedTestCaseSampleDataProps) => {
  const { t } = useTranslation();
  const [sampleData, setSampleData] = useState<LocalSampleData>();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [showActions, setShowActions] = useState(false);
  const { permissions } = usePermissionProvider();
  const { version } = useParams<{ version: string }>();
  const isVersionPage = !isUndefined(version);

  const columnName = useMemo(
    () =>
      testCaseData?.entityLink
        ? getColumnNameFromEntityLink(testCaseData?.entityLink)
        : undefined,
    [testCaseData]
  );

  const hasViewSampleDataPermission = useMemo(() => {
    return checkPermission(
      Operation.ViewSampleData,
      ResourceEntity.TEST_CASE,
      permissions
    );
  }, [permissions]);

  const hasEditPermission = useMemo(() => {
    return isVersionPage
      ? false
      : checkPermission(
          Operation.EditAll,
          ResourceEntity.TEST_CASE,
          permissions
        );
  }, [permissions, isVersionPage]);

  const handleDeleteModal = () => {
    setIsDeleteModalOpen((prev) => !prev);
  };

  const manageButtonContent: ItemType[] = [
    {
      label: (
        <ManageButtonItemLabel
          description={t('message.delete-entity-type-action-description', {
            entityType: t('label.sample-data'),
          })}
          icon={IconDelete}
          id="delete-button"
          name={t('label.delete')}
        />
      ),
      key: 'delete-button',
      onClick: (e) => {
        e.domEvent.stopPropagation();
        setShowActions(false);
        handleDeleteModal();
      },
    },
  ];

  const getSampleDataWithType = (tableData: TableData): LocalSampleData => {
    const columns: SampleDataColumn[] = (tableData?.columns ?? []).map(
      (column) => ({
        id: column,
        label: column === DIFF_TYPE ? '' : column,
      })
    );

    const rows = (tableData?.rows ?? []).map((item, index) => {
      const dataObject: Record<string, SampleDataType> = {};
      (tableData?.columns ?? []).forEach((col, colIndex) => {
        dataObject[col] = item[colIndex];
      });
      dataObject[ROW_KEY] = index;

      return dataObject;
    });

    return { columns, rows };
  };

  const fetchFailedTestCaseSampleData = async () => {
    if (testCaseData?.id) {
      setIsLoading(true);
      try {
        const response = await getTestCaseFailedSampleData(testCaseData.id);
        setSampleData(getSampleDataWithType(response));
      } catch {
        setSampleData(undefined);
      } finally {
        setIsLoading(false);
      }
    }

    return;
  };

  const handleDeleteSampleData = async () => {
    if (testCaseData?.id) {
      try {
        await deleteTestCaseFailedSampleData(testCaseData.id);
        handleDeleteModal();
        fetchFailedTestCaseSampleData();
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.delete-entity-error', {
            entity: t('label.sample-data'),
          })
        );
      }
    }

    return;
  };

  useEffect(() => {
    if (hasViewSampleDataPermission) {
      fetchFailedTestCaseSampleData();
    }
  }, [testCaseData?.id, hasViewSampleDataPermission]);

  if (!hasViewSampleDataPermission) {
    return <></>;
  }

  if (isLoading) {
    return <Loader />;
  }

  if (isUndefined(sampleData)) {
    return <></>;
  }

  return (
    <div className="w-full">
      <Space className="m-b-md justify-between w-full">
        <Typography className="right-panel-label" size="text-sm">
          {t('label.sample-data')}
        </Typography>
        <div className="d-flex gap-4">
          {testCaseData?.inspectionQuery && !isVersionPage && (
            <Link
              to={observabilityRouterClassBase.getTestCaseDetailPagePath(
                testCaseData?.fullyQualifiedName ?? '',
                TestCasePageTabs.SQL_QUERY
              )}>
              <Button data-testid="explore-with-query" type="primary">
                {t('label.explore-with-query')}
              </Button>
            </Link>
          )}
          {hasEditPermission && (
            <Dropdown
              menu={{
                items: manageButtonContent,
              }}
              open={showActions}
              overlayClassName="manage-dropdown-list-container"
              overlayStyle={{ width: '350px' }}
              placement="bottomRight"
              trigger={['click']}
              onOpenChange={setShowActions}>
              <Tooltip
                placement="topLeft"
                title={t('label.manage-entity', {
                  entity: t('label.sample-data'),
                })}>
                <Button
                  className="flex-center px-1.5"
                  data-testid="sample-data-manage-button"
                  onClick={() => setShowActions(true)}>
                  <IconDropdown className="anticon self-center " />
                </Button>
              </Tooltip>
            </Dropdown>
          )}
        </div>
      </Space>
      <div className="tw:overflow-x-auto tw:border tw:border-border-secondary tw:rounded-[10px]">
        <Table
          aria-label={t('label.sample-data')}
          data-testid="sample-data-table"
          size="sm">
          <Table.Header columns={sampleData.columns}>
            {(col) => (
              <Table.Head
                className={classNames('tw:px-2 tw:py-2', {
                  'tw:min-w-52.5': col.id !== DIFF_TYPE,
                })}
                id={col.id}
                key={col.id}
                label={col.label}
              />
            )}
          </Table.Header>
          <Table.Body items={sampleData.rows}>
            {(record) => {
              const diffType = record[DIFF_TYPE];

              return (
                <Table.Row
                  className={classNames({
                    'tw:bg-success-primary': diffType === DIFF_TYPE_VALUES.ADD,
                    'tw:bg-gray-50': diffType === DIFF_TYPE_VALUES.NOT_EQUAL,
                    'tw:bg-error-primary': diffType === DIFF_TYPE_VALUES.REMOVE,
                  })}
                  columns={sampleData.columns}
                  id={record[ROW_KEY] as number}
                  key={record[ROW_KEY] as number}>
                  {(col) => {
                    const isDiffCol = col.id === DIFF_TYPE;
                    const isFailedCol = col.id === columnName;

                    return (
                      <Table.Cell
                        className={classNames('tw:p-2', {
                          'tw:border-r tw:border-r-gray-blue-100 tw:text-center tw:align-middle':
                            isDiffCol,
                          'failed-sample-data-column tw:bg-error-primary':
                            isFailedCol,
                          'tw:min-w-52.5': !isDiffCol,
                        })}>
                        {isDiffCol ? (
                          <Typography
                            className={classNames({
                              'tw:text-success-primary':
                                diffType === DIFF_TYPE_VALUES.ADD,
                              'tw:text-gray-500':
                                diffType === DIFF_TYPE_VALUES.NOT_EQUAL,
                              'tw:text-error-primary':
                                diffType === DIFF_TYPE_VALUES.REMOVE,
                            })}
                            size="text-sm"
                            weight="medium">
                            {record[col.id] as string}
                          </Typography>
                        ) : (
                          <Typography
                            className={
                              isFailedCol ? 'tw:text-error-primary' : undefined
                            }
                            size="text-sm">
                            <RowData data={record[col.id] as SampleDataType} />
                          </Typography>
                        )}
                      </Table.Cell>
                    );
                  }}
                </Table.Row>
              );
            }}
          </Table.Body>
        </Table>
      </div>
      {isDeleteModalOpen && (
        <EntityDeleteModal
          bodyText={getEntityDeleteMessage(t('label.sample-data'), '')}
          entityName={t('label.sample-data')}
          entityType={EntityType.SAMPLE_DATA}
          visible={isDeleteModalOpen}
          onCancel={handleDeleteModal}
          onConfirm={handleDeleteSampleData}
        />
      )}
    </div>
  );
};

export default FailedTestCaseSampleData;
