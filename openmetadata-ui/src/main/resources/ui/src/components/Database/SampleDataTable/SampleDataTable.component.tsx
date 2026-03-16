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

import { Button, Dropdown, Select, Space, Tooltip, Typography } from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { AxiosError } from 'axios';
import classNames from 'classnames';

import { isEmpty, lowerCase } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconDelete } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as IconDownload } from '../../../assets/svg/ic-download.svg';
import { ReactComponent as IconDropdown } from '../../../assets/svg/menu.svg';
import { AUTO_CLASSIFICATION_DOCS } from '../../../constants/docs.constants';
import { mockDatasetData } from '../../../constants/mockTourData.constants';
import { useTourProvider } from '../../../context/TourProvider/TourProvider';
import { EntityType } from '../../../enums/entity.enum';
import { Table } from '../../../generated/entity/data/table';
import { withLoader } from '../../../hoc/withLoader';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  deleteSampleDataByTableId,
  getSampleDataByTableId,
} from '../../../rest/tableAPI';
import {
  getEntityDeleteMessage,
  Transi18next,
} from '../../../utils/CommonUtils';
import { downloadFile } from '../../../utils/Export/ExportUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import { ManageButtonItemLabel } from '../../common/ManageButtonContentItem/ManageButtonContentItem.component';
import TableComponent from '../../common/Table/Table';
import EntityDeleteModal from '../../Modals/EntityDeleteModal/EntityDeleteModal';
import { RowData } from './RowData';
import './sample-data-table.less';
import {
  SampleData,
  SampleDataProps,
  SampleDataType,
} from './SampleData.interface';
import {
  buildSampleDataCSVContent,
  ROW_LIMIT_OPTIONS,
} from './SampleDataTable.utils';

const SampleDataTable: FC<SampleDataProps> = ({
  isTableDeleted,
  tableId,
  owners,
  permissions,
}) => {
  const { isTourPage } = useTourProvider();
  const { currentUser, theme } = useApplicationStore();
  const { t } = useTranslation();
  const [sampleData, setSampleData] = useState<SampleData>();
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [showActions, setShowActions] = useState(false);
  const [rowLimit, setRowLimit] = useState<number>(100);

  const isCurrentUserTableOwner = useMemo(() => {
    return owners?.some((owner) => owner.id === currentUser?.id);
  }, [owners, currentUser]);

  const hasPermission = useMemo(
    () =>
      permissions.EditAll ||
      permissions.EditSampleData ||
      isCurrentUserTableOwner,
    [isCurrentUserTableOwner, permissions]
  );

  const handleDeleteModal = useCallback(
    () => setIsDeleteModalOpen((prev) => !prev),
    []
  );

  const slicedRows = useMemo(
    () => sampleData?.rows?.slice(0, rowLimit),
    [sampleData?.rows, rowLimit]
  );

  const exportToCSV = useCallback(() => {
    if (!sampleData?.rows || !sampleData?.columns) {
      return;
    }
    const columnNames = sampleData.columns.map((col) => String(col.key ?? ''));
    const csvContent = buildSampleDataCSVContent(
      columnNames,
      sampleData.rows,
      rowLimit
    );

    downloadFile(
      csvContent,
      `sample_data_${rowLimit}_rows.csv`,
      'text/csv;charset=utf-8;'
    );
  }, [sampleData, rowLimit]);

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
        width: 250,
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
          description={t('message.download-entity-data', {
            entity: t('label.sample-data'),
          })}
          icon={IconDownload}
          id="export-button"
          name={t('label.export')}
        />
      ),
      key: 'export-button',
      onClick: (e: { domEvent: { stopPropagation: () => void } }) => {
        e.domEvent.stopPropagation();
        setShowActions(false);
        exportToCSV();
      },
    },
    ...(hasPermission
      ? [
          {
            label: (
              <ManageButtonItemLabel
                description={t(
                  'message.delete-entity-type-action-description',
                  {
                    entityType: t('label.sample-data'),
                  }
                )}
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
        ]
      : []),
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
                aria-label={t('label.auto-classification')}
                href={AUTO_CLASSIFICATION_DOCS}
                rel="noreferrer"
                style={{ color: theme.primaryColor }}
                target="_blank"
              />
            }
            values={{
              entity: t('label.auto-classification'),
            }}
          />
        </Typography.Paragraph>
      </ErrorPlaceHolder>
    );
  }

  return (
    <div
      className={classNames('p-md border-default border-radius-sm bg-white', {
        'h-70vh overflow-hidden': isTourPage,
      })}
      data-testid="sample-data"
      id="sampleDataDetails">
      <Space className="m-y-xss justify-between w-full">
        <Space>
          <Typography.Text className="text-grey-muted">
            {t('label.row-limit')}:
          </Typography.Text>
          <Select
            className="w-28"
            data-testid="row-limit-select"
            value={rowLimit}
            onChange={setRowLimit}>
            {ROW_LIMIT_OPTIONS.map((limit) => (
              <Select.Option
                data-testid={`row-limit-option-${limit}`}
                key={limit}
                value={limit}>
                {limit}
              </Select.Option>
            ))}
          </Select>
        </Space>
        <Dropdown
          menu={{
            items: manageButtonContent,
          }}
          open={showActions}
          overlayClassName="manage-dropdown-list-container"
          overlayStyle={{ width: '350px' }}
          placement="bottomRight"
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
      </Space>

      <TableComponent
        columns={sampleData?.columns}
        data-testid="sample-data-table"
        dataSource={slicedRows}
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

export default withLoader(SampleDataTable);
