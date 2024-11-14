/*
 *  Copyright 2024 Collate.
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
import ReactDataGrid from '@inovua/reactdatagrid-community';
import '@inovua/reactdatagrid-community/index.css';
import { TypeComputedProps } from '@inovua/reactdatagrid-community/types';
import { Button, Modal, Typography } from 'antd';
import { isEmpty, omit } from 'lodash';
import React, { FC, MutableRefObject, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomProperty } from '../../../../generated/type/customProperty';
import { getEntityName } from '../../../../utils/EntityUtils';
import { TableTypePropertyValueType } from '../CustomPropertyTable.interface';
import './edit-table-type-property.less';
import TableTypePropertyView from './TableTypePropertyView';

interface EditTableTypePropertyModalProps {
  isVisible: boolean;
  isUpdating: boolean;
  property: CustomProperty;
  columns: string[];
  rows: Record<string, string>[];
  onCancel: () => void;
  onSave: (data: TableTypePropertyValueType) => Promise<void>;
}

let inEdit = false;

const EditTableTypePropertyModal: FC<EditTableTypePropertyModalProps> = ({
  isVisible,
  isUpdating,
  property,
  columns,
  rows,
  onCancel,
  onSave,
}) => {
  const { t } = useTranslation();

  const [dataSource, setDataSource] = useState<
    TableTypePropertyValueType['rows']
  >(() => rows.map((row, index) => ({ ...row, id: index + '' })));

  const [gridRef, setGridRef] = useState<
    MutableRefObject<TypeComputedProps | null>
  >({ current: null });

  const filterColumns = columns.map((column) => ({
    name: column,
    header: column,
    defaultFlex: 1,
    sortable: false,
    minWidth: 180,
  }));

  const onEditComplete = useCallback(
    ({ value, columnId, rowId }) => {
      const data = [...dataSource];

      data[rowId][columnId] = value;

      setDataSource(data);
    },
    [dataSource]
  );

  const onEditStart = () => {
    inEdit = true;
  };

  const onEditStop = () => {
    requestAnimationFrame(() => {
      inEdit = false;
      gridRef.current?.focus();
    });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (inEdit) {
      if (event.key === 'Escape') {
        const [rowIndex, colIndex] = gridRef.current?.computedActiveCell ?? [
          0, 0,
        ];
        const column = gridRef.current?.getColumnBy(colIndex);

        gridRef.current?.cancelEdit?.({
          rowIndex,
          columnId: column?.name ?? '',
        });
      }

      return;
    }
    const grid = gridRef.current;
    if (!grid) {
      return;
    }
    let [rowIndex, colIndex] = grid.computedActiveCell ?? [0, 0];

    if (event.key === ' ' || event.key === 'Enter') {
      const column = grid.getColumnBy(colIndex);
      grid.startEdit?.({ columnId: column.name ?? '', rowIndex });
      event.preventDefault();

      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const direction = event.shiftKey ? -1 : 1;

    const columns = grid.visibleColumns;
    const rowCount = grid.count;

    colIndex += direction;
    if (colIndex === -1) {
      colIndex = columns.length - 1;
      rowIndex -= 1;
    }
    if (colIndex === columns.length) {
      rowIndex += 1;
      colIndex = 0;
    }
    if (rowIndex < 0 || rowIndex === rowCount) {
      return;
    }

    grid?.setActiveCell([rowIndex, colIndex]);
  };

  const handleAddRow = useCallback(() => {
    setDataSource((data) => {
      setTimeout(() => {
        gridRef.current?.scrollToId(data.length + '');
        gridRef.current?.focus();
      }, 1);

      return [...data, { id: data.length + '' }];
    });
  }, [gridRef]);

  const handleUpdate = useCallback(async () => {
    const modifiedRows = dataSource
      .map((row) => omit(row, 'id'))
      // if the row is empty, filter it out
      .filter((row) => !isEmpty(row) && Object.values(row).some(Boolean));
    await onSave({ rows: modifiedRows, columns });
  }, [onSave, dataSource, columns]);

  return (
    <Modal
      centered
      destroyOnClose
      closable={false}
      data-testid="edit-table-type-property-modal"
      footer={
        <div className="d-flex justify-between">
          <Button
            data-testid="add-new-row"
            disabled={isUpdating}
            type="primary"
            onClick={handleAddRow}>
            {t('label.add-entity', { entity: t('label.row') })}
          </Button>

          <div className="d-flex gap-2">
            <Button
              data-testid="cancel-update-table-type-property"
              disabled={isUpdating}
              onClick={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              data-testid="update-table-type-property"
              disabled={isUpdating}
              loading={isUpdating}
              type="primary"
              onClick={handleUpdate}>
              {t('label.update')}
            </Button>
          </div>
        </div>
      }
      maskClosable={false}
      open={isVisible}
      title={
        <Typography.Text>
          {t('label.edit-entity-name', {
            entityType: t('label.property'),
            entityName: getEntityName(property),
          })}
        </Typography.Text>
      }
      width={800}>
      {isEmpty(dataSource) ? (
        <TableTypePropertyView columns={columns} rows={rows} />
      ) : (
        <ReactDataGrid
          editable
          className="edit-table-type-property"
          columns={filterColumns}
          dataSource={dataSource}
          handle={setGridRef}
          idProperty="id"
          minRowHeight={30}
          showZebraRows={false}
          style={{ height: '350px' }}
          onEditComplete={onEditComplete}
          onEditStart={onEditStart}
          onEditStop={onEditStop}
          onKeyDown={onKeyDown}
        />
      )}
    </Modal>
  );
};

export default EditTableTypePropertyModal;
