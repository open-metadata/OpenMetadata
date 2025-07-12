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
import '@inovua/reactdatagrid-community/index.css';
import { TypeComputedProps } from '@inovua/reactdatagrid-community/types';
import { Button, Modal, Typography } from 'antd';
import { isEmpty, omit } from 'lodash';
import { FC, MutableRefObject, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getEntityName } from '../../../../utils/EntityUtils';
import { KeyDownStopPropagationWrapper } from '../../KeyDownStopPropagationWrapper/KeyDownStopPropagationWrapper';
import { TableTypePropertyValueType } from '../CustomPropertyTable.interface';
import './edit-table-type-property.less';
import { EditTableTypePropertyModalProps } from './EditTableTypePropertyModal.interface';
import TableTypePropertyEditTable from './TableTypePropertyEditTable';
import TableTypePropertyView from './TableTypePropertyView';

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

  const handleEditGridRef = useCallback(
    (ref: MutableRefObject<TypeComputedProps | null>) => {
      setGridRef(ref);
    },
    []
  );

  const handleEditDataSource = useCallback((data: Record<string, string>[]) => {
    setDataSource(data);
  }, []);

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
        <KeyDownStopPropagationWrapper>
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
        </KeyDownStopPropagationWrapper>
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
        <KeyDownStopPropagationWrapper>
          <TableTypePropertyEditTable
            columns={columns}
            dataSource={dataSource}
            gridRef={gridRef}
            handleEditDataSource={handleEditDataSource}
            handleEditGridRef={handleEditGridRef}
          />
        </KeyDownStopPropagationWrapper>
      )}
    </Modal>
  );
};

export default EditTableTypePropertyModal;
