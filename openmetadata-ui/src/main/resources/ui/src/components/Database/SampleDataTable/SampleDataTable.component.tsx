/*
 *  Copyright 2022 Collate.
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
  Button,
  Dropdown,
  Space,
  Table as AntdTable,
  Tooltip,
  Typography,
} from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { t } from 'i18next';
import { isEmpty, lowerCase } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ReactComponent as IconDelete } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as IconDropdown } from '../../../assets/svg/menu.svg';
import { WORKFLOWS_PROFILER_DOCS } from '../../../constants/docs.constants';
import { DROPDOWN_ICON_SIZE_PROPS } from '../../../constants/ManageButton.constants';
import { mockDatasetData } from '../../../constants/mockTourData.constants';
import { useTourProvider } from '../../../context/TourProvider/TourProvider';
import { EntityType } from '../../../enums/entity.enum';
import { Table } from '../../../generated/entity/data/table';
import { withLoader } from '../../../hoc/withLoader';
import {
  deleteSampleDataByTableId,
  getSampleDataByTableId,
} from '../../../rest/tableAPI';
import {
  getEntityDeleteMessage,
  Transi18next,
} from '../../../utils/CommonUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useAuthContext } from '../../Auth/AuthProviders/AuthProvider';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import { ManageButtonItemLabel } from '../../common/ManageButtonContentItem/ManageButtonContentItem.component';
import EntityDeleteModal from '../../Modals/EntityDeleteModal/EntityDeleteModal';
import { RowData } from './RowData';
import './sample-data-table.less';
import {
  SampleData,
  SampleDataProps,
  SampleDataType,
} from './SampleData.interface';

const SampleDataTable = ({
  isTableDeleted,
  tableId,
  ownerId,
  permissions,
}: SampleDataProps) => {
  const { isTourPage } = useTourProvider();
  const { currentUser } = useAuthContext();

  const [sampleData, setSampleData] = useState<SampleData>();
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [showActions, setShowActions] = useState(false);

  const hasPermission = useMemo(
    () =>
      permissions.EditAll ||
      permissions.EditSampleData ||
      currentUser?.id === ownerId,
    [ownerId, permissions, currentUser]
  );

  const handleDeleteModal = useCallback(
    () => setIsDeleteModalOpen((prev) => !prev),
    []
  );

  const getSampleDataWithType = (table: Table) => {
    const { sampleData, columns } = table;
    const updatedColumns = sampleData?.columns?.map((column) => {
      const matchedColumn = columns.find((col) => col.name === column);

      return {
        name: column,
        dataType: matchedColumn?.dataType ?? '',
        title: (
          <div className="d-flex flex-column">
            <Typography.Text> {column}</Typography.Text>
            {matchedColumn?.dataType && (
              <Typography.Text className="text-grey-muted text-xs font-normal">{`(${lowerCase(
                matchedColumn?.dataType ?? ''
              )})`}</Typography.Text>
            )}
          </div>
        ),
        dataIndex: column,
        key: column,
        accessor: column,
        width: 210,
        render: (data: SampleDataType) => <RowData data={data} />,
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

  const fetchSampleData = async () => {
    try {
      const tableData = await getSampleDataByTableId(tableId);
      setSampleData(getSampleDataWithType(tableData));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSampleData = async () => {
    try {
      await deleteSampleDataByTableId(tableId);
      handleDeleteModal();
      fetchSampleData();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.delete-entity-error', {
          entity: t('label.sample-data'),
        })
      );
    }
  };

  const manageButtonContent: ItemType[] = [
    {
      label: (
        <ManageButtonItemLabel
          description={t('message.delete-entity-type-action-description', {
            entityType: t('label.sample-data'),
          })}
          icon={
            <IconDelete
              className="m-t-xss"
              {...DROPDOWN_ICON_SIZE_PROPS}
              name="Delete"
            />
          }
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

  useEffect(() => {
    setIsLoading(true);
    if (!isTableDeleted && tableId && !isTourPage) {
      fetchSampleData();
    } else {
      setIsLoading(false);
    }
    if (isTourPage) {
      setSampleData(
        getSampleDataWithType({
          columns: mockDatasetData.tableDetails.columns,
          sampleData: mockDatasetData.sampleData,
        } as unknown as Table)
      );
    }
  }, [tableId]);

  if (isLoading) {
    return <Loader />;
  }

  if (isEmpty(sampleData?.rows) && isEmpty(sampleData?.columns)) {
    return (
      <ErrorPlaceHolder className="error-placeholder">
        <Typography.Paragraph>
          <Transi18next
            i18nKey="message.view-sample-data-entity"
            renderElement={
              <a
                href={WORKFLOWS_PROFILER_DOCS}
                rel="noreferrer"
                style={{ color: '#1890ff' }}
                target="_blank"
              />
            }
            values={{
              entity: t('label.profiler-ingestion'),
            }}
          />
        </Typography.Paragraph>
      </ErrorPlaceHolder>
    );
  }

  return (
    <div
      className={classNames('m-md', {
        'h-70vh overflow-hidden': isTourPage,
      })}
      data-testid="sample-data"
      id="sampleDataDetails">
      <Space className="m-b-md justify-end w-full">
        {hasPermission && (
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
      </Space>

      <AntdTable
        bordered
        columns={sampleData?.columns}
        data-testid="sample-data-table"
        dataSource={sampleData?.rows}
        pagination={false}
        rowKey="name"
        scroll={{ y: 'calc(100vh - 160px)' }}
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

export default withLoader<SampleDataProps>(SampleDataTable);
