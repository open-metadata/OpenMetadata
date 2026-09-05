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
  Alert,
  Badge,
  Button,
  Dialog,
  InputBase,
  InputGroup,
  Modal,
  ModalOverlay,
  ProgressBarBase,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { Loading01 } from '@untitledui/icons';
import { lowerCase } from 'lodash';
import { FC, Fragment, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BETA_EXPORT_TYPES,
  ExportTypes,
} from '../../../constants/Export.constants';
import exportUtilClassBase from '../../../utils/ExportUtilClassBase';
import {
  CSVExportJob,
  ExportData,
} from './EntityExportModalProvider.interface';

interface EntityExportModalProps {
  csvExportJob?: Partial<CSVExportJob>;
  downloading: boolean;
  exportData: ExportData;
  fileName: string;
  selectedExportType: ExportTypes;
  onCancel: () => void;
  onExport: (data: {
    fileName: string;
    exportType: ExportTypes;
  }) => Promise<void>;
  onFileNameChange: (fileName: string) => void;
  onSelectedExportTypeChange: (exportType: ExportTypes) => void;
}

const AlertSpinnerIcon: FC<{ className?: string }> = () => (
  <Loading01 className="tw:size-5 tw:animate-spin" />
);

export const EntityExportModal: FC<EntityExportModalProps> = ({
  csvExportJob,
  downloading,
  exportData,
  fileName,
  selectedExportType,
  onCancel,
  onExport,
  onFileNameChange,
  onSelectedExportTypeChange,
}) => {
  const { t } = useTranslation();
  const exportLabel = t('label.export');
  const dialogTitle = exportData.title ?? exportLabel;
  const exportTypeItems = useMemo(() => {
    const options = exportUtilClassBase.getExportTypeOptions();

    return exportData.exportTypes
      .map((exportType) =>
        options.find((option) => option.value === exportType)
      )
      .filter((option): option is NonNullable<typeof option> => Boolean(option))
      .map((option) => ({ id: option.value, label: option.label }));
  }, [exportData.exportTypes]);
  const isExportInProgress =
    csvExportJob?.status === 'IN_PROGRESS' && !csvExportJob.statusUnavailable;

  let alertVariant: 'error' | 'brand' | 'success' = 'success';
  if (csvExportJob?.error || csvExportJob?.statusUnavailable) {
    alertVariant = 'error';
  } else if (downloading) {
    alertVariant = 'brand';
  }

  return (
    <ModalOverlay isOpen>
      <Modal>
        <Dialog
          aria-label={dialogTitle}
          data-testid="export-entity-modal"
          width={480}
          onClose={onCancel}>
          <Dialog.Header>
            <Typography
              as="h3"
              className="tw:text-primary"
              size="text-lg"
              weight="semibold">
              {dialogTitle}
            </Typography>
          </Dialog.Header>
          <Dialog.Content>
            <Select
              data-testid="export-type-select"
              isDisabled={exportData.exportTypes.length === 1}
              items={exportTypeItems}
              label={`${t('label.export-type')}:`}
              selectedKey={selectedExportType}
              onSelectionChange={(key) =>
                key && onSelectedExportTypeChange(key as ExportTypes)
              }>
              {(item) => (
                <Select.Item id={item.id} textValue={item.label}>
                  <div className="tw:flex tw:items-center tw:gap-2">
                    {item.label}
                    {BETA_EXPORT_TYPES.some(
                      (exportType) => exportType === item.id
                    ) && (
                      <Badge color="gray" size="sm">
                        {t('label.beta')}
                      </Badge>
                    )}
                  </div>
                </Select.Item>
              )}
            </Select>

            <InputGroup
              label={`${t('label.entity-name', {
                entity: t('label.file'),
              })}:`}
              trailingAddon={
                <InputGroup.Prefix position="trailing">
                  {`.${lowerCase(selectedExportType)}`}
                </InputGroup.Prefix>
              }
              value={fileName}
              onChange={onFileNameChange}>
              <InputBase inputDataTestId="file-name-input" />
            </InputGroup>

            {csvExportJob?.jobId && (
              <Fragment>
                {isExportInProgress &&
                  csvExportJob.progress !== undefined &&
                  csvExportJob.total !== undefined && (
                    <div className="tw:flex tw:flex-col tw:gap-2">
                      <ProgressBarBase
                        max={csvExportJob.total}
                        value={csvExportJob.progress}
                      />
                      <Typography
                        as="span"
                        className="tw:text-tertiary"
                        size="text-xs">
                        {csvExportJob.message}
                      </Typography>
                    </div>
                  )}
                {!isExportInProgress && (
                  <Alert
                    icon={
                      !csvExportJob.error && downloading
                        ? AlertSpinnerIcon
                        : undefined
                    }
                    title={
                      csvExportJob.statusUnavailable
                        ? t('server.entity-fetch-error', {
                            entity: t('label.status'),
                          })
                        : csvExportJob.error ?? csvExportJob.message ?? ''
                    }
                    variant={alertVariant}
                  />
                )}
              </Fragment>
            )}
          </Dialog.Content>
          <Dialog.Footer>
            <Button color="secondary" size="lg" onClick={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="submit-button"
              isDisabled={downloading}
              isLoading={downloading}
              size="lg"
              onClick={() =>
                onExport({ fileName, exportType: selectedExportType })
              }>
              {exportLabel}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
