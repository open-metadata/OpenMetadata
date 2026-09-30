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
  Dialog,
  FileUploadDropZone,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
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
import { importTeam, importUserInTeam } from '../../../../../../rest/teamsAPI';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import { TeamImportResult } from '../../../../../Settings/Team/TeamImportResult/TeamImportResult.component';
import { UserImportResult } from '../../../../../Settings/Team/UserImportResult/UserImportResult.component';

export type MembersImportType = 'teams' | 'users';

interface MembersImportModalProps {
  fqn: string;
  importType: MembersImportType;
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const UploadContent: FC<{
  entity: string;
  fileName: string;
  onDropFiles: (files: FileList) => void;
  onUnsupported: () => void;
}> = ({ entity, fileName, onDropFiles, onUnsupported }) => {
  const { t } = useTranslation();

  return (
    <Box direction="col" gap={4}>
      <Typography className="tw:text-secondary" size="text-sm">
        {t('message.import-entity-help', { entity })}
      </Typography>
      <FileUploadDropZone
        accept=".csv"
        allowsMultiple={false}
        clickToUploadLabel={t('label.click-to-upload')}
        hint={t('label.csv')}
        input-data-testid="members-import-input"
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
    </Box>
  );
};

const PreviewContent: FC<{
  importType: MembersImportType;
  result: CSVImportResult;
}> = ({ importType, result }) => {
  const { t } = useTranslation();
  const isFailure = result.status === Status.Failure;
  const isAborted = result.status === Status.Aborted;

  if (isAborted) {
    return (
      <Alert
        data-testid="import-aborted"
        title={result.abortReason ?? t('label.aborted')}
        variant="error"
      />
    );
  }

  return (
    <Box direction="col" gap={4}>
      <Alert
        data-testid="import-summary"
        title={t('message.import-result-summary', {
          passed: result.numberOfRowsPassed ?? 0,
          failed: result.numberOfRowsFailed ?? 0,
          processed: result.numberOfRowsProcessed ?? 0,
        })}
        variant={isFailure ? 'error' : 'success'}
      />
      {importType === 'users' ? (
        <UserImportResult csvImportResult={result} />
      ) : (
        <TeamImportResult csvImportResult={result} />
      )}
    </Box>
  );
};

const ImportFooter: FC<{
  activeStep: 1 | 2 | 3;
  isImporting: boolean;
  canConfirm: boolean;
  onBack: () => void;
  onCancel: () => void;
  onImport: () => void;
  onDone: () => void;
}> = ({
  activeStep,
  isImporting,
  canConfirm,
  onBack,
  onCancel,
  onImport,
  onDone,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog.Footer>
      {activeStep === 2 && (
        <Button
          color="secondary"
          data-testid="back-import"
          isDisabled={isImporting}
          size="sm"
          onPress={onBack}>
          {t('label.back')}
        </Button>
      )}
      <Button
        color="secondary"
        data-testid="cancel-import"
        isDisabled={isImporting}
        size="sm"
        onPress={onCancel}>
        {t('label.cancel')}
      </Button>
      {canConfirm && (
        <Button
          color="primary"
          data-testid="confirm-import"
          isLoading={isImporting}
          size="sm"
          onPress={onImport}>
          {t('label.import')}
        </Button>
      )}
      {activeStep === 3 && (
        <Button
          color="primary"
          data-testid="done-import"
          size="sm"
          onPress={onDone}>
          {t('label.done')}
        </Button>
      )}
    </Dialog.Footer>
  );
};

const MembersImportModal: FC<MembersImportModalProps> = ({
  fqn,
  importType,
  open,
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

  const entity = importType === 'users' ? t('label.user') : t('label.team');

  const runImport = useCallback(
    (data: string, dryRun: boolean) =>
      importType === 'users'
        ? importUserInTeam(fqn, data, dryRun)
        : importTeam(fqn, data, dryRun),
    [fqn, importType]
  );

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
          const response = await runImport(content, true);
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
    [runImport, t]
  );

  const handleUnsupportedFile = useCallback(
    () => showErrorToast(t('message.invalid-file-format', { formats: '.csv' })),
    [t]
  );

  const handleImport = useCallback(async () => {
    setIsImporting(true);
    try {
      const response = await runImport(csvContent, false);
      activeJobRef.current = { ...response, type: 'onValidate' };
    } catch (error) {
      showErrorToast(error as AxiosError);
      setIsImporting(false);
    }
  }, [runImport, csvContent]);

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
      if (response.jobId !== job?.jobId || response.status !== 'COMPLETED') {
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

  const canConfirmImport =
    activeStep === 2 &&
    csvImportResult?.status !== Status.Failure &&
    csvImportResult?.status !== Status.Aborted;

  return (
    <ModalOverlay
      isDismissable={!isImporting}
      isOpen={open}
      onOpenChange={(isOpen) => !isOpen && !isImporting && onCancel()}>
      <Modal>
        <Dialog
          showCloseButton
          title={t('label.import-entity', { entity })}
          width={720}
          onClose={onCancel}>
          <Dialog.Content>
            <div data-testid="members-import-modal">
              {activeStep === 1 && (
                <UploadContent
                  entity={entity}
                  fileName={fileName}
                  onDropFiles={handleDropFiles}
                  onUnsupported={handleUnsupportedFile}
                />
              )}
              {activeStep === 2 && csvImportResult && (
                <PreviewContent
                  importType={importType}
                  result={csvImportResult}
                />
              )}
              {activeStep === 3 && (
                <Typography className="tw:text-primary" weight="semibold">
                  {t('message.entity-imported-successfully', { entity })}
                </Typography>
              )}
            </div>
          </Dialog.Content>

          <ImportFooter
            activeStep={activeStep}
            canConfirm={canConfirmImport}
            isImporting={isImporting}
            onBack={handleBack}
            onCancel={onCancel}
            onDone={onSuccess}
            onImport={handleImport}
          />
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default MembersImportModal;
