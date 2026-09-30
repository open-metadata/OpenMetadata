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
  Box,
  Button,
  FileUploadDropZone,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SOCKET_EVENTS } from '../../../../../../constants/constants';
import { useWebSocketConnector } from '../../../../../../context/WebSocketProvider/WebSocketProvider';
import {
  CSVImportResult,
  Status,
} from '../../../../../../generated/type/csvImportResult';
import {
  CSVImportAsyncWebsocketResponse,
  CSVImportJobType,
} from '../../../../../../pages/EntityImport/BulkEntityImportPage/BulkEntityImportPage.interface';
import { importTeam } from '../../../../../../rest/teamsAPI';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import { TeamImportResult } from '../../../../../Settings/Team/TeamImportResult/TeamImportResult.component';

interface MembersImportFormProps {
  fqn: string;
  onCancel: () => void;
  onSuccess: () => void;
}

const UploadStep: FC<{
  fileName: string;
  onCancel: () => void;
  onDropFiles: (files: FileList) => void;
  onUnsupported: () => void;
}> = ({ fileName, onCancel, onDropFiles, onUnsupported }) => {
  const { t } = useTranslation();

  return (
    <>
      <Typography className="tw:text-secondary" size="text-sm">
        {t('message.import-entity-help', { entity: t('label.team') })}
      </Typography>
      <FileUploadDropZone
        accept=".csv"
        allowsMultiple={false}
        clickToUploadLabel={t('label.click-to-upload')}
        hint={t('label.csv')}
        input-data-testid="team-import-input"
        orDragAndDropLabel={t('label.or-drag-and-drop')}
        onDropFiles={onDropFiles}
        onDropUnacceptedFiles={onUnsupported}
      />
      {fileName && (
        <Typography
          className="tw:text-secondary"
          data-testid="import-file-name"
          size="text-sm"
          weight="medium">
          {fileName}
        </Typography>
      )}
      <Box direction="row" gap={2} justify="end">
        <Button
          color="tertiary"
          data-testid="cancel-import"
          size="sm"
          onPress={onCancel}>
          {t('label.cancel')}
        </Button>
      </Box>
    </>
  );
};

const PreviewStep: FC<{
  result: CSVImportResult;
  isImporting: boolean;
  onBack: () => void;
  onImport: () => void;
}> = ({ result, isImporting, onBack, onImport }) => {
  const { t } = useTranslation();
  const isFailure = result.status === Status.Failure;
  const isAborted = result.status === Status.Aborted;

  return (
    <>
      {isAborted ? (
        <Alert
          data-testid="import-aborted"
          title={result.abortReason ?? t('label.aborted')}
          variant="error"
        />
      ) : (
        <>
          <Alert
            data-testid="import-summary"
            title={t('message.import-result-summary', {
              passed: result.numberOfRowsPassed ?? 0,
              failed: result.numberOfRowsFailed ?? 0,
              processed: result.numberOfRowsProcessed ?? 0,
            })}
            variant={isFailure ? 'error' : 'success'}
          />
          <TeamImportResult csvImportResult={result} />
        </>
      )}
      <Box direction="row" gap={2} justify="end">
        <Button
          color="tertiary"
          data-testid="back-import"
          isDisabled={isImporting}
          size="sm"
          onPress={onBack}>
          {t('label.back')}
        </Button>
        {!isFailure && !isAborted && (
          <Button
            color="primary"
            data-testid="confirm-import"
            isLoading={isImporting}
            size="sm"
            onPress={onImport}>
            {t('label.import')}
          </Button>
        )}
      </Box>
    </>
  );
};

const DoneStep: FC<{ onView: () => void }> = ({ onView }) => {
  const { t } = useTranslation();

  return (
    <Box align="center" direction="col" gap={4} justify="center">
      <Typography className="tw:text-primary" weight="semibold">
        {t('message.entity-imported-successfully', { entity: t('label.team') })}
      </Typography>
      <Button
        color="primary"
        data-testid="view-import"
        size="sm"
        onPress={onView}>
        {t('label.view')}
      </Button>
    </Box>
  );
};

const MembersImportForm: FC<MembersImportFormProps> = ({
  fqn,
  onCancel,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { socket } = useWebSocketConnector();

  const [fileName, setFileName] = useState('');
  const [csvContent, setCsvContent] = useState('');
  const [csvImportResult, setCsvImportResult] = useState<CSVImportResult>();
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [isImporting, setIsImporting] = useState(false);
  const activeJobRef = useRef<CSVImportJobType>();

  const handleDropFiles = useCallback(
    (files: FileList) => {
      const file = files[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = (event.target?.result as string) ?? '';
        setFileName(file.name);
        setCsvContent(content);
        try {
          const response = await importTeam(fqn, content, true);
          activeJobRef.current = {
            ...response,
            type: 'initialLoad',
            initialResult: content,
          };
        } catch (error) {
          showErrorToast(error as AxiosError);
        }
      };
      reader.onerror = () => showErrorToast(t('server.unexpected-error'));
      reader.readAsText(file);
    },
    [fqn, t]
  );

  const handleUnsupportedFile = useCallback(
    () =>
      showErrorToast(
        t('message.invalid-file-format', { formats: '.csv' })
      ),
    [t]
  );

  const handleImport = useCallback(async () => {
    setIsImporting(true);
    try {
      const response = await importTeam(fqn, csvContent, false);
      activeJobRef.current = { ...response, type: 'onValidate' };
    } catch (error) {
      showErrorToast(error as AxiosError);
      setIsImporting(false);
    }
  }, [fqn, csvContent]);

  const handleBack = useCallback(() => {
    setCsvImportResult(undefined);
    setActiveStep(1);
  }, []);

  useEffect(() => {
    if (!socket) {
      return;
    }
    socket.on(SOCKET_EVENTS.CSV_IMPORT_CHANNEL, (payload: string) => {
      if (!payload) {
        return;
      }
      const response = JSON.parse(payload) as CSVImportAsyncWebsocketResponse;
      const job = activeJobRef.current;
      if (
        response.jobId !== job?.jobId ||
        response.status !== 'COMPLETED'
      ) {
        return;
      }
      setCsvImportResult(response.result);
      if (job.type === 'initialLoad') {
        setActiveStep(2);
      } else {
        setActiveStep(3);
        setIsImporting(false);
      }
      activeJobRef.current = undefined;
    });

    return () => {
      socket.off(SOCKET_EVENTS.CSV_IMPORT_CHANNEL);
    };
  }, [socket]);

  return (
    <Box
      className="tw:flex-1 tw:overflow-y-auto tw:px-8 tw:py-4"
      data-testid="team-import"
      direction="col"
      gap={4}>
      {activeStep === 1 && (
        <UploadStep
          fileName={fileName}
          onCancel={onCancel}
          onDropFiles={handleDropFiles}
          onUnsupported={handleUnsupportedFile}
        />
      )}

      {activeStep === 2 && !isUndefined(csvImportResult) && (
        <PreviewStep
          isImporting={isImporting}
          result={csvImportResult}
          onBack={handleBack}
          onImport={handleImport}
        />
      )}

      {activeStep === 3 && <DoneStep onView={onSuccess} />}
    </Box>
  );
};

export default MembersImportForm;
