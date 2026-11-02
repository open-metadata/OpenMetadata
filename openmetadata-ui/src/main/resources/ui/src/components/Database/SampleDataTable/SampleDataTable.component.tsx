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

import { Box, Select, Typography } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';

import { isEmpty, lowerCase } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconDelete } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as IconDownload } from '../../../assets/svg/ic-download.svg';
import { AUTO_CLASSIFICATION_DOCS } from '../../../constants/docs.constants';
import { EntityType } from '../../../enums/entity.enum';
import { Container } from '../../../generated/entity/data/container';
import { Table } from '../../../generated/entity/data/table';
import { withLoader } from '../../../hoc/withLoader';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  deleteSampleDataByContainerId,
  getSampleDataByContainerId,
} from '../../../rest/storageAPI';
import {
  deleteSampleDataByTableId,
  getSampleDataByTableId,
} from '../../../rest/tableAPI';
import { getEntityDeleteMessage } from '../../../utils/EntityDisplayPureUtils';
import { downloadCsv } from '../../../utils/Export/ExportUtils';
import { Transi18next } from '../../../utils/i18next/LocalUtil';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { showErrorToast } from '../../../utils/ToastUtils';
import DeleteModal from '../../common/DeleteModal/DeleteModal';
import NoDataPlaceholder from '../../common/EmptyPlaceholder/NoDataPlaceholder';
import {
  ManageMenu,
  ManageMenuItem,
} from '../../common/EntityPageInfos/ManageButton/ManageMenu';
import Loader from '../../common/Loader/Loader';
import { ManageButtonItemLabel } from '../../common/ManageButtonContentItem/ManageButtonContentItem.component';
import TableComponent from '../../common/Table/TableV2';
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

/**
 * Ant Design treats `children` on a row record as nested rows and reads the row
 * key off a record field, so raw column names cannot be used as record keys: a
 * column named `children` crashes the table, and a repeated cell value collides
 * as a row key. Addressing every cell by column index keeps record keys unique
 * and clear of both reserved names.
 */
const ROW_KEY = '__rowKey';

const getSampleDataColumnKey = (index: number, column: string) =>
  `${index}-${column}`;

const SampleDataTable: FC<SampleDataProps> = ({
  isTableDeleted,
  tableId,
  owners,
  permissions,
  entityType = EntityType.TABLE,
}) => {
  const { currentUser, theme } = useApplicationStore();
  const { t } = useTranslation();
  const [sampleData, setSampleData] = useState<SampleData>();
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showActions, setShowActions] = useState(false);
  const [rowLimit, setRowLimit] = useState<number>(100);

  const isCurrentUserTableOwner = useMemo(() => {
    return owners?.some((owner) => owner.id === currentUser?.id);
  }, [owners, currentUser]);

  // Consumer via the `permissions: OperationPermission` prop (raw contract kept per Task 8
  // rule 2). No `deleted` argument: isTableDeleted is a separate prop gating a different
  // concern (the fetch effect below) — the old `hasPermission` expression never referenced
  // it. N-term raw OR containing a bare `EditAll` term (Task 8 Batch 2 KnowledgeCard
  // precedent): naively dropping the EditAll term in favor of just canEditSampleData would
  // regress the case where EditAll=true but EditSampleData is explicitly false (old code's
  // bare `EditAll ||` wins unconditionally) — so canEditAll is kept as its own explicit
  // OR-term alongside the prioritized canEditSampleData, restoring byte-for-byte equivalence.
  const { canEditAll, canEditSampleData } = useMemo(
    () => getDerivedPermissionFlags(permissions),
    [permissions]
  );
  const hasPermission = useMemo(
    () => canEditAll || canEditSampleData || isCurrentUserTableOwner,
    [canEditAll, canEditSampleData, isCurrentUserTableOwner]
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
    const csvContent = buildSampleDataCSVContent(
      sampleData.columns,
      sampleData.rows,
      rowLimit
    );

    downloadCsv(csvContent, `sample_data_${rowLimit}_rows.csv`);
  }, [sampleData, rowLimit]);

  const getSampleDataWithType = (entity: Table | Container) => {
    const { sampleData } = entity;
    const columns =
      'columns' in entity ? entity.columns : entity.dataModel?.columns ?? [];

    const updatedColumns = sampleData?.columns?.map((column, index) => {
      const matchedColumn = columns.find((col) => col.name === column);
      const columnKey = getSampleDataColumnKey(index, column);

      return {
        name: column,
        title: (
          <Box className="tw:text-start tw:wrap-anywhere" direction="col">
            <Typography> {column}</Typography>
            {matchedColumn?.dataType && (
              <Typography
                className="text-xs font-normal"
                color="secondary">{`(${lowerCase(
                matchedColumn?.dataType ?? ''
              )})`}</Typography>
            )}
          </Box>
        ),
        dataIndex: columnKey,
        key: columnKey,
        width: 250,
        render: (data: SampleDataType) => <RowData data={data} />,
      };
    });

    const data = (sampleData?.rows ?? []).map((item, rowIndex) => {
      const dataObject: Record<string, SampleDataType> = {
        [ROW_KEY]: rowIndex,
      };
      (sampleData?.columns ?? []).forEach((col, index) => {
        dataObject[getSampleDataColumnKey(index, col)] = item[index];
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
      const entityData =
        entityType === EntityType.CONTAINER
          ? await getSampleDataByContainerId(tableId)
          : await getSampleDataByTableId(tableId);
      setSampleData(getSampleDataWithType(entityData));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSampleData = async () => {
    try {
      setIsDeleting(true);
      if (entityType === EntityType.CONTAINER) {
        await deleteSampleDataByContainerId(tableId);
      } else {
        await deleteSampleDataByTableId(tableId);
      }
      handleDeleteModal();
      fetchSampleData();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.delete-entity-error', {
          entity: t('label.sample-data'),
        })
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const manageButtonContent: ManageMenuItem[] = [
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
      onClick: () => {
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
            onClick: () => {
              setShowActions(false);
              handleDeleteModal();
            },
          },
        ]
      : []),
  ];

  useEffect(() => {
    setIsLoading(true);
    if (!isTableDeleted && tableId) {
      fetchSampleData();
    } else {
      setIsLoading(false);
    }
  }, [tableId]);

  if (isLoading) {
    return <Loader />;
  }

  if (isEmpty(sampleData?.rows) && isEmpty(sampleData?.columns)) {
    return (
      <div className="tw:relative tw:h-full tw:w-full tw:min-h-[calc(100vh-255px)] tw:rounded-xl tw:border tw:border-secondary tw:bg-surface tw:in-[.assistant-content]:min-h-60">
        <NoDataPlaceholder
          data-testid="no-data-placeholder"
          description={
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
          }
        />
      </div>
    );
  }

  return (
    <div
      className="p-md border-default border-radius-sm bg-white"
      data-testid="sample-data"
      id="sampleDataDetails">
      <Box
        inline
        align="center"
        className="layout-space layout-space-horizontal m-y-xss justify-between w-full"
        gap={2}
        itemClassName="layout-space-item">
        <Box
          inline
          align="center"
          className="layout-space layout-space-horizontal"
          gap={2}
          itemClassName="layout-space-item">
          <Typography color="secondary">{t('label.row-limit')}:</Typography>
          <Select
            aria-label={t('label.row-limit')}
            className="tw:w-28"
            data-testid="row-limit-select"
            selectedKey={String(rowLimit)}
            onSelectionChange={(key) =>
              key !== null && setRowLimit(Number(key))
            }>
            {ROW_LIMIT_OPTIONS.map((limit) => (
              <Select.Item
                data-testid={`row-limit-option-${limit}`}
                id={String(limit)}
                key={limit}
                label={String(limit)}
              />
            ))}
          </Select>
        </Box>
        <ManageMenu
          data-testid="sample-data-manage-button"
          isOpen={showActions}
          items={manageButtonContent}
          label={t('label.manage-entity', {
            entity: t('label.sample-data'),
          })}
          onOpenChange={setShowActions}
        />
      </Box>

      <TableComponent
        columns={sampleData?.columns}
        data-testid="sample-data-table"
        dataSource={slicedRows}
        pagination={false}
        rowKey={ROW_KEY}
        // Each column is a fixed 250px; give the table an explicit horizontal
        // extent so TableV2 keeps those widths and lets the wrapper scroll,
        // instead of collapsing every column into a share of the viewport.
        scroll={{
          x: (sampleData?.columns?.length ?? 0) * 250,
          y: 'calc(100vh - 160px)',
        }}
        size="small"
      />

      {isDeleteModalOpen && (
        <DeleteModal
          entityTitle={t('label.sample-data')}
          isDeleting={isDeleting}
          message={getEntityDeleteMessage(t('label.sample-data'), '')}
          open={isDeleteModalOpen}
          onCancel={handleDeleteModal}
          onDelete={handleDeleteSampleData}
        />
      )}
    </div>
  );
};

export default withLoader(SampleDataTable);
