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

import { Button, Dropdown, Space, Table, Tooltip, Typography } from 'antd';
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
import { getEntityDeleteMessage } from '../../../../utils/CommonUtils';
import { getColumnNameFromEntityLink } from '../../../../utils/EntityUtils';
import { checkPermission } from '../../../../utils/PermissionsUtils';
import { getTestCaseDetailPagePath } from '../../../../utils/RouterUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import Loader from '../../../common/Loader/Loader';
import { ManageButtonItemLabel } from '../../../common/ManageButtonContentItem/ManageButtonContentItem.component';
import { RowData } from '../../../Database/SampleDataTable/RowData';
import {
  SampleData,
  SampleDataType,
} from '../../../Database/SampleDataTable/SampleData.interface';
import EntityDeleteModal from '../../../Modals/EntityDeleteModal/EntityDeleteModal';
import './failed-test-case-sample-data.less';
import { FailedTestCaseSampleDataProps } from './FailedTestCaseSampleData.interface';

const DIFF_TYPE = 'diffType';
const DIFF_TYPE_VALUES = {
  ADD: '+',
  REMOVE: '-',
  NOT_EQUAL: '!=',
};

const FailedTestCaseSampleData = ({
  testCaseData,
}: FailedTestCaseSampleDataProps) => {
  const { t } = useTranslation();
  const [sampleData, setSampleData] = useState<SampleData>();
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
  const getSampleDataWithType = (sampleData: TableData) => {
    const updatedColumns = sampleData?.columns?.map((column) => {
      return {
        name: column,
        title:
          column === DIFF_TYPE ? (
            ''
          ) : (
            <div className="d-flex flex-column">
              <Typography.Text> {column}</Typography.Text>
            </div>
          ),
        dataIndex: column,
        key: column,
        accessor: column,
        width: column === DIFF_TYPE ? undefined : 210,
        render: (data: SampleDataType) => ({
          props: {
            className: classNames({
              'failed-sample-data-column': column === columnName,
              'diff-type-sample-data-column': column === DIFF_TYPE,
            }),
          },
          children: <RowData data={data} />,
        }),
      };
    });

    const data = (sampleData?.rows ?? []).map((item) => {
      const dataObject: Record<string, SampleDataType> = {};
      (sampleData?.columns ?? []).forEach((col, index) => {
        dataObject[col] = item[index];
      });

      return dataObject;
    });

    return {
      columns: updatedColumns,
      rows: data,
    };
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
        <Typography.Text className="right-panel-label">
          {t('label.sample-data')}
        </Typography.Text>
        <div className="d-flex gap-4">
          {testCaseData?.inspectionQuery && !isVersionPage && (
            <Link
              to={getTestCaseDetailPagePath(
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
      <Table
        bordered
        columns={sampleData.columns}
        data-testid="sample-data-table"
        dataSource={sampleData.rows}
        pagination={false}
        rowClassName={(record) => {
          const type = record?.diffType;

          return classNames({
            'remove-sample-data': type === DIFF_TYPE_VALUES.REMOVE,
            'add-sample-data': type === DIFF_TYPE_VALUES.ADD,
            'not-equal-sample-data': type === DIFF_TYPE_VALUES.NOT_EQUAL,
          });
        }}
        rowKey="name"
        scroll={{ x: 'max-content' }}
        size="small"
      />
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
