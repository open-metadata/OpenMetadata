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
import { Button, Col, Row, Typography } from 'antd';
import { isEmpty } from 'lodash';
import { useEffect, useMemo } from 'react';
import DataGrid, { ColumnOrColumnGroup } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { useTranslation } from 'react-i18next';
import { readString } from 'react-papaparse';
import { useNavigate } from 'react-router-dom';
import {
  HEADER_HEIGHT,
  MAX_HEIGHT,
  ROW_HEIGHT,
} from '../../constants/BulkEdit.constants';
import { ExportTypes } from '../../constants/Export.constants';
import { EntityType } from '../../enums/entity.enum';
import { useFqn } from '../../hooks/useFqn';
import {
  getBulkEditCSVExportEntityApi,
  getBulkEntityNavigationPath,
  getColumnsWithUpdatedFlag,
} from '../../utils/EntityBulkEdit/EntityBulkEditUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import Banner from '../common/Banner/Banner';
import Loader from '../common/Loader/Loader';
import TitleBreadcrumb from '../common/TitleBreadcrumb/TitleBreadcrumb.component';
import { useEntityExportModalProvider } from '../Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import { BulkEditEntityProps } from './BulkEditEntity.interface';

const BulkEditEntity = ({
  dataSource,
  columns,
  breadcrumbList,
  activeStep,
  handleBack,
  handleValidate,
  isValidating,
  validationData,
  validateCSVData,
  activeAsyncImportJob,
  onCSVReadComplete,
  setGridContainer,
  handleCopy,
  handlePaste,
  handleOnRowsChange,
  sourceEntityType,
  handleAddRow,
}: BulkEditEntityProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fqn } = useFqn();
  const { entityType } = useRequiredParams<{ entityType: EntityType }>();
  const { triggerExportForBulkEdit, csvExportData, clearCSVExportData } =
    useEntityExportModalProvider();

  const handleCancel = () => {
    clearCSVExportData();
    navigate(getBulkEntityNavigationPath(entityType, fqn, sourceEntityType));
  };

  useEffect(() => {
    triggerExportForBulkEdit({
      name: fqn,
      onExport: getBulkEditCSVExportEntityApi(entityType),
      exportTypes: [ExportTypes.CSV],
    });
  }, []);

  useEffect(() => {
    if (csvExportData) {
      readString(csvExportData, {
        worker: true,
        skipEmptyLines: true,
        complete: onCSVReadComplete,
      });
    }
  }, [csvExportData]);

  useEffect(() => {
    // clear the csvExportData data from the state
    return () => {
      clearCSVExportData();
    };
  }, []);

  /*
    Owner dropdown uses <ProfilePicture /> which uses useUserProfile hook
    useUserProfile hook uses useApplicationStore hook
    Updating store will trigger re-render of the component
    This will cause the owner dropdown or full grid to re-render
  */

  const gridHeight = useMemo(() => {
    const contentHeight = dataSource.length * ROW_HEIGHT + HEADER_HEIGHT;
    const maxHeightPx = window.innerHeight - 280;

    return contentHeight < maxHeightPx ? 'auto' : MAX_HEIGHT;
  }, [dataSource.length]);

  const editDataGrid = useMemo(() => {
    return (
      <div className="om-rdg" ref={setGridContainer}>
        <DataGrid
          className="rdg-light"
          columns={
            columns as unknown as ColumnOrColumnGroup<
              NoInfer<Record<string, string>>,
              unknown
            >[]
          }
          rows={dataSource}
          style={{ height: gridHeight, maxHeight: MAX_HEIGHT }}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onRowsChange={handleOnRowsChange}
        />
      </div>
    );
  }, [
    columns,
    dataSource,
    handleCopy,
    handlePaste,
    handleOnRowsChange,
    handleAddRow,
    t,
    gridHeight,
  ]);

  const newRowIds = useMemo(() => {
    return new Set(
      dataSource.filter((row) => row.isNewRow === 'true').map((row) => row.id)
    );
  }, [dataSource]);

  const columnsUpdated = useMemo(() => {
    return getColumnsWithUpdatedFlag(validateCSVData?.columns, newRowIds);
  }, [validateCSVData?.columns, newRowIds]);

  return (
    <>
      <Col span={24}>
        <TitleBreadcrumb titleLinks={breadcrumbList} />
      </Col>

      <Col span={24}>
        {activeAsyncImportJob?.jobId && (
          <Banner
            className="border-radius"
            isLoading={!activeAsyncImportJob.error}
            message={
              activeAsyncImportJob.error ?? activeAsyncImportJob.message ?? ''
            }
            type={activeAsyncImportJob.error ? 'error' : 'success'}
          />
        )}
      </Col>

      {isEmpty(csvExportData) ? (
        <Loader />
      ) : (
        <Col span={24}>
          <div className="bg-white rounded-12 bulk-edit-container">
            {activeStep === 1 && (
              <>
                <Row className="m-b-md" justify="space-between">
                  <Col>
                    <Typography.Title className="m-b-0" level={5}>
                      {t('label.edit-entity', {
                        entity: t('label.column'),
                      })}
                    </Typography.Title>
                  </Col>
                  <Col>
                    <Button disabled={isValidating} onClick={handleCancel}>
                      {t('label.cancel')}
                    </Button>
                    <Button
                      className="m-l-sm"
                      disabled={isValidating}
                      type="primary"
                      onClick={handleValidate}>
                      {t('label.preview')}
                    </Button>
                  </Col>
                </Row>

                {editDataGrid}
                <Button
                  className="p-0 m-t-xs"
                  data-testid="add-row-btn"
                  type="link"
                  onClick={handleAddRow}>
                  {`+ ${t('label.add-row')}`}
                </Button>
              </>
            )}

            {activeStep === 2 && validationData && (
              <>
                <Row className="m-b-md" justify="space-between">
                  <Col>
                    <Typography.Title className="m-b-0" level={5}>
                      {t('label.edit-entity', {
                        entity: t('label.column'),
                      })}
                    </Typography.Title>
                  </Col>
                  <Col>
                    <Button disabled={isValidating} onClick={handleBack}>
                      {t('label.back')}
                    </Button>
                    <Button
                      className="m-l-sm"
                      disabled={isValidating}
                      type="primary"
                      onClick={handleValidate}>
                      {t('label.update')}
                    </Button>
                  </Col>
                </Row>

                {validateCSVData && (
                  <div className="om-rdg">
                    <DataGrid
                      className="rdg-light"
                      columns={
                        columnsUpdated as unknown as ColumnOrColumnGroup<
                          NoInfer<Record<string, string>>,
                          unknown
                        >[]
                      }
                      rows={validateCSVData.dataSource}
                      style={{
                        height:
                          validateCSVData.dataSource.length * ROW_HEIGHT +
                            HEADER_HEIGHT <
                          window.innerHeight - 280
                            ? 'auto'
                            : MAX_HEIGHT,
                        maxHeight: MAX_HEIGHT,
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </Col>
      )}
    </>
  );
};

export default BulkEditEntity;
