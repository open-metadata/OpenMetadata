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
import {
  TypeColumn,
  TypeComputedProps,
} from '@inovua/reactdatagrid-community/types';
import { Button, Card, Col, Row, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { MutableRefObject, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePapaParse } from 'react-papaparse';

import {
  ENTITY_IMPORT_STEPS,
  VALIDATION_STEP,
} from '../../constants/BulkImport.constant';
import { CSVImportResult } from '../../generated/type/csvImportResult';
import {
  getCSVStringFromColumnsAndDataSource,
  getEntityColumnsAndDataSourceFromCSV,
} from '../../utils/CSV/CSV.utils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { ImportStatus } from '../common/EntityImport/ImportStatus/ImportStatus.component';
import Stepper from '../Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component';
import { UploadFile } from '../UploadFile/UploadFile';
import './bulk-entity-import.style.less';
import { BulkImportProps } from './BulkEntityImport.interface';

let inEdit = false;

const BulkEntityImport = ({
  entityType,
  fqn,
  onValidateCsvString,
  onSuccess,
  hideAddButton,
}: BulkImportProps) => {
  const [activeStep, setActiveStep] = useState<VALIDATION_STEP>(
    VALIDATION_STEP.UPLOAD
  );
  const { t } = useTranslation();
  const [isValidating, setIsValidating] = useState(false);
  const [validationData, setValidationData] = useState<CSVImportResult>();
  const [columns, setColumns] = useState<TypeColumn[]>([]);
  const [dataSource, setDataSource] = useState<Record<string, string>[]>([]);
  const { readString } = usePapaParse();
  const [validateCSVData, setValidateCSVData] =
    useState<{ columns: TypeColumn[]; dataSource: Record<string, string>[] }>();
  const [gridRef, setGridRef] = useState<
    MutableRefObject<TypeComputedProps | null>
  >({ current: null });

  const focusToGrid = useCallback(() => {
    setGridRef((ref) => {
      ref.current?.focus();

      return ref;
    });
  }, [setGridRef]);

  const onCSVReadComplete = useCallback(
    (results: { data: string[][] }) => {
      // results.data is returning data with unknown type
      const { columns, dataSource } = getEntityColumnsAndDataSourceFromCSV(
        results.data as string[][]
      );
      setDataSource(dataSource);
      setColumns(columns);

      setActiveStep(VALIDATION_STEP.EDIT_VALIDATE);
      setTimeout(focusToGrid, 500);
    },
    [setDataSource, setColumns, setActiveStep, focusToGrid]
  );

  const validateCsvString = useCallback(
    async (csvData: string) => await onValidateCsvString(csvData, true),
    []
  );

  const handleLoadData = useCallback(
    async (e: ProgressEvent<FileReader>) => {
      try {
        const result = e.target?.result as string;

        const validationResponse = await validateCsvString(result);

        if (['failure', 'aborted'].includes(validationResponse?.status ?? '')) {
          setValidationData(validationResponse);

          setActiveStep(VALIDATION_STEP.UPLOAD);

          return;
        }

        if (result) {
          readString(result, {
            worker: true,
            skipEmptyLines: true,
            complete: onCSVReadComplete,
          });
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [onCSVReadComplete]
  );

  const onEditComplete = useCallback(
    ({ value, columnId, rowId }) => {
      const data = [...dataSource];
      data[rowId][columnId] = value;

      setDataSource(data);
    },
    [dataSource]
  );

  const handleBack = () => {
    if (activeStep === VALIDATION_STEP.UPDATE) {
      setActiveStep(VALIDATION_STEP.EDIT_VALIDATE);
    } else {
      setActiveStep(VALIDATION_STEP.UPLOAD);
    }
  };

  const handleValidate = async () => {
    setIsValidating(true);
    setValidateCSVData(undefined);
    try {
      // Call the validate API
      const csvData = getCSVStringFromColumnsAndDataSource(columns, dataSource);

      const response = await onValidateCsvString(
        csvData,
        activeStep === VALIDATION_STEP.EDIT_VALIDATE
      );

      if (activeStep === VALIDATION_STEP.UPDATE) {
        if (response?.status === 'failure') {
          setValidationData(response);
          readString(response?.importResultsCsv ?? '', {
            worker: true,
            skipEmptyLines: true,
            complete: (results) => {
              // results.data is returning data with unknown type
              setValidateCSVData(
                getEntityColumnsAndDataSourceFromCSV(results.data as string[][])
              );
            },
          });
          setActiveStep(VALIDATION_STEP.UPDATE);
        } else {
          showSuccessToast(
            t('message.entity-details-updated', {
              entityType,
              fqn,
            })
          );
          onSuccess();
        }
      } else if (activeStep === VALIDATION_STEP.EDIT_VALIDATE) {
        setValidationData(response);
        setActiveStep(VALIDATION_STEP.UPDATE);
        readString(response?.importResultsCsv ?? '', {
          worker: true,
          skipEmptyLines: true,
          complete: (results) => {
            // results.data is returning data with unknown type
            setValidateCSVData(
              getEntityColumnsAndDataSourceFromCSV(results.data as string[][])
            );
          },
        });
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsValidating(false);
    }
  };

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

  const handleRetryCsvUpload = () => {
    setValidationData(undefined);

    setActiveStep(VALIDATION_STEP.UPLOAD);
  };

  return (
    <Row className="p-x-lg" gutter={[16, 16]}>
      <Col span={24}>
        <Stepper activeStep={activeStep} steps={ENTITY_IMPORT_STEPS} />
      </Col>
      <Col span={24}>
        {activeStep === 0 && (
          <>
            {validationData?.abortReason ? (
              <Card className="m-t-lg">
                <Space
                  align="center"
                  className="w-full justify-center p-lg text-center"
                  direction="vertical"
                  size={16}>
                  <Typography.Text
                    className="text-center"
                    data-testid="abort-reason">
                    <strong className="d-block">{t('label.aborted')}</strong>{' '}
                    {validationData.abortReason}
                  </Typography.Text>
                  <Space size={16}>
                    <Button
                      ghost
                      data-testid="cancel-button"
                      type="primary"
                      onClick={handleRetryCsvUpload}>
                      {t('label.back')}
                    </Button>
                  </Space>
                </Space>
              </Card>
            ) : (
              <UploadFile fileType=".csv" onCSVUploaded={handleLoadData} />
            )}
          </>
        )}
        {activeStep === 1 && (
          <ReactDataGrid
            editable
            columns={columns}
            dataSource={dataSource}
            defaultActiveCell={[0, 0]}
            handle={setGridRef}
            idProperty="id"
            loading={isValidating}
            minRowHeight={30}
            showZebraRows={false}
            style={{ height: 'calc(100vh - 245px)' }}
            onEditComplete={onEditComplete}
            onEditStart={onEditStart}
            onEditStop={onEditStop}
            onKeyDown={onKeyDown}
          />
        )}
        {activeStep === 2 && validationData && (
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <ImportStatus csvImportResult={validationData} />
            </Col>
            <Col span={24}>
              {validateCSVData && (
                <ReactDataGrid
                  idProperty="id"
                  loading={isValidating}
                  style={{ height: 'calc(100vh - 300px)' }}
                  {...validateCSVData}
                />
              )}
            </Col>
          </Row>
        )}
      </Col>
      {activeStep > 0 && (
        <Col span={24}>
          {activeStep === 1 && !hideAddButton && (
            <Button data-testid="add-row-btn" onClick={handleAddRow}>
              {`+ ${t('label.add-row')}`}
            </Button>
          )}
          <div className="float-right import-footer">
            {activeStep > 0 && (
              <Button onClick={handleBack}>{t('label.previous')}</Button>
            )}
            {activeStep < 3 && (
              <Button
                className="m-l-sm"
                loading={isValidating}
                type="primary"
                onClick={handleValidate}>
                {activeStep === 2 ? t('label.update') : t('label.next')}
              </Button>
            )}
          </div>
        </Col>
      )}
    </Row>
  );
};

export default BulkEntityImport;
