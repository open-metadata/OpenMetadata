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
  Box,
  Button,
  Card,
  FeaturedIcon,
  FileUploadDropZone,
  ProgressBar,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  AlertTriangle,
  Check,
  CheckCircle,
  ChevronRight,
  File06,
  RefreshCw01,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import {
  FC,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ENTITY_IMPORT_STEPS,
  VALIDATION_STEP,
} from '../../../../../../constants/BulkImport.constant';
import { SOCKET_EVENTS } from '../../../../../../constants/constants';
import { useWebSocketConnector } from '../../../../../../context/WebSocketProvider/WebSocketProvider';
import {
  CSVImportResult,
  Status,
} from '../../../../../../generated/type/csvImportResult';
import {
  CSVImportAsyncWebsocketResponse,
  CSVImportJobType,
} from '../../../../../../interface/entity/csv.interface';
import { importTeam, importUserInTeam } from '../../../../../../rest/teamsAPI';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import { STAGE_ICON_CLASS } from './Members.constants';
import type {
  ActiveJob,
  MembersImportFormProps,
  ProcessingType,
  SelectedCsvFile,
  StageState,
} from './Members.types';
import { getCsvFileSizeLabel, getCsvRowCount } from './Members.utils';
import MembersImportResultTable from './MembersImportResultTable';

const ImportStepper: FC<{ activeStep: VALIDATION_STEP }> = ({ activeStep }) => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:w-full tw:pb-2"
      data-testid="stepper-container"
      gap={2}
      justify="center">
      <span hidden data-testid="stepper" />
      <span hidden data-testid="active-step">
        {activeStep}
      </span>
      {ENTITY_IMPORT_STEPS.map((step, index) => {
        const isActive = step.step === activeStep;
        const isDone = step.step < activeStep;
        const circleClass =
          isActive || isDone
            ? 'tw:bg-brand-solid tw:text-primary_on-brand'
            : 'tw:bg-tertiary tw:text-utility-gray-700';

        return (
          <Fragment key={step.step}>
            <Badge
              className="tw:gap-1.5"
              color={isActive ? 'brand' : 'gray'}
              data-active={isActive}
              data-testid={`csv-workflow-step-${step.step}`}
              size="md">
              <Box
                align="center"
                className={`tw:size-4 tw:rounded-full tw:text-[10px] tw:font-semibold ${circleClass}`}
                justify="center">
                {isDone ? <Check size={10} strokeWidth={2.5} /> : index + 1}
              </Box>
              {t(step.name)}
            </Badge>
            {index < ENTITY_IMPORT_STEPS.length - 1 && (
              <Box
                aria-hidden
                className={`tw:h-px tw:w-10 ${
                  isDone ? 'tw:bg-brand-solid' : 'tw:bg-border-secondary'
                }`}
              />
            )}
          </Fragment>
        );
      })}
    </Box>
  );
};

const SelectedFileCard: FC<{
  file: SelectedCsvFile;
  rowCountLabel: string;
  onRemove: () => void;
}> = ({ file, rowCountLabel, onRemove }) => {
  const { t } = useTranslation();

  return (
    <Card
      className="tw:w-full tw:text-left"
      data-testid="selected-file-card"
      variant="elevated">
      <Box align="center" className="tw:p-4" gap={3}>
        <FeaturedIcon color="brand" icon={File06} size="md" theme="light" />
        <Box align="start" className="tw:min-w-0 tw:flex-1" direction="col">
          <Typography ellipsis={{ tooltip: file.name }} weight="semibold">
            {file.name}
          </Typography>
          <Typography className="tw:text-tertiary tw:text-left" size="text-sm">
            {`${file.sizeLabel} · ${rowCountLabel}`}
          </Typography>
        </Box>
        <Button
          aria-label={t('label.remove')}
          color="tertiary"
          data-testid="remove-file"
          iconLeading={XClose}
          onPress={onRemove}
        />
      </Box>
    </Card>
  );
};

const renderStageIcon = (state: StageState) => {
  if (state === 'done') {
    return <CheckCircle size={14} />;
  }
  if (state === 'active') {
    return <RefreshCw01 className="tw:animate-spin" size={14} />;
  }

  return <Box className="tw:size-1.5 tw:rounded-full tw:bg-fg-quaternary" />;
};

const ProcessingStage: FC<{ label: string; state: StageState }> = ({
  label,
  state,
}) => (
  <Box
    align="center"
    className={`tw:text-sm tw:font-medium ${
      state === 'pending' ? 'tw:text-tertiary' : 'tw:text-secondary'
    }`}
    gap={3}>
    <Box
      align="center"
      className={`tw:size-5 tw:shrink-0 tw:rounded-full ${STAGE_ICON_CLASS[state]}`}
      justify="center">
      {renderStageIcon(state)}
    </Box>
    <Typography as="span">{label}</Typography>
  </Box>
);

const ProcessingBanner: FC<{
  title: string;
  fileName: string;
  rowCountLabel: string;
  progress: number;
  stages?: { key: string; label: string; state: StageState }[];
}> = ({ title, fileName, rowCountLabel, progress, stages }) => (
  <Card
    className="tw:mx-auto tw:w-full tw:max-w-[520px]"
    data-testid="import-processing"
    variant="elevated">
    <Box align="center" className="tw:p-10" direction="col" gap={5}>
      <Box
        align="center"
        className="tw:size-16 tw:rounded-full tw:bg-brand-secondary tw:text-featured-icon-light-fg-brand"
        justify="center">
        <RefreshCw01 className="tw:animate-spin tw:size-7" />
      </Box>
      <Box align="center" direction="col" gap={1}>
        <Typography
          className="tw:text-primary"
          size="text-lg"
          weight="semibold">
          {title}
        </Typography>
        <Box
          align="center"
          className="tw:text-tertiary tw:text-sm"
          gap={2}
          justify="center">
          <File06 className="tw:shrink-0" size={14} />
          <Typography as="span" ellipsis={{ tooltip: fileName }}>
            {fileName}
          </Typography>
          <Typography as="span" className="tw:shrink-0">
            {rowCountLabel}
          </Typography>
        </Box>
      </Box>
      <Box className="tw:w-full">
        <ProgressBar value={progress} />
      </Box>
      {stages && (
        <Box className="tw:w-full tw:gap-3.5" direction="col">
          {stages.map((stage) => (
            <ProcessingStage
              key={stage.key}
              label={stage.label}
              state={stage.state}
            />
          ))}
        </Box>
      )}
    </Box>
  </Card>
);

const AbortCard: FC<{ reason?: string; onBack: () => void }> = ({
  reason,
  onBack,
}) => {
  const { t } = useTranslation();

  return (
    <Card
      className="tw:mx-auto tw:w-full tw:max-w-[520px]"
      data-testid="import-aborted"
      variant="elevated">
      <Box align="center" className="tw:p-10" direction="col" gap={4}>
        <FeaturedIcon
          color="error"
          icon={AlertTriangle}
          size="lg"
          theme="light"
        />
        <Box align="center" direction="col" gap={1}>
          <Typography className="tw:text-primary" weight="semibold">
            {t('label.aborted')}
          </Typography>
          <Typography
            className="tw:w-full tw:text-tertiary tw:text-center tw:break-words"
            data-testid="abort-reason"
            size="text-sm">
            {reason}
          </Typography>
        </Box>
        <Button color="secondary" data-testid="abort-back" onPress={onBack}>
          {t('label.back')}
        </Button>
      </Box>
    </Card>
  );
};

const UploadStep: FC<{
  entity: string;
  selectedFile?: SelectedCsvFile;
  rowCountLabel: string;
  onDropFiles: (files: FileList) => void;
  onUnsupported: () => void;
  onRemove: () => void;
}> = ({
  entity,
  selectedFile,
  rowCountLabel,
  onDropFiles,
  onUnsupported,
  onRemove,
}) => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:mx-auto tw:w-full tw:max-w-[50%]"
      direction="col"
      gap={4}>
      <Typography className="tw:text-secondary" size="text-sm">
        {t('message.import-entity-help', { entity })}
      </Typography>
      {selectedFile ? (
        <SelectedFileCard
          file={selectedFile}
          rowCountLabel={rowCountLabel}
          onRemove={onRemove}
        />
      ) : (
        <FileUploadDropZone
          accept=".csv"
          allowsMultiple={false}
          className="tw:w-full tw:py-14"
          clickToUploadLabel={t('label.click-to-upload')}
          hint={t('message.accepts-file-up-to-size', {
            fileType: '.csv',
            size: '10 MB',
          })}
          input-data-testid="members-import-input"
          orDragAndDropLabel={t('label.or-drag-and-drop')}
          onDropFiles={onDropFiles}
          onDropUnacceptedFiles={onUnsupported}
        />
      )}
      <Alert title={t('label.tip')} variant="brand">
        {t('message.import-entity-csv-tip', { entity })}
      </Alert>
    </Box>
  );
};

const PreviewContent: FC<{ result: CSVImportResult }> = ({ result }) => {
  const { t } = useTranslation();
  const isFailure = result.status === Status.Failure;

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
      <MembersImportResultTable csvImportResult={result} />
    </Box>
  );
};

const SuccessContent: FC<{ entity: string; fileName: string }> = ({
  entity,
  fileName,
}) => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:w-full tw:py-8"
      data-testid="import-success"
      direction="col"
      gap={4}
      justify="center">
      <FeaturedIcon
        color="success"
        icon={CheckCircle}
        size="lg"
        theme="light"
      />
      <Typography className="tw:text-primary" weight="semibold">
        {t('message.entity-imported-successfully', { entity })}
      </Typography>
      {fileName && (
        <Typography className="tw:text-tertiary" size="text-sm">
          <strong data-testid="file-name">{fileName}</strong>{' '}
          {t('label.successfully-uploaded').toLowerCase()}
        </Typography>
      )}
    </Box>
  );
};

const ImportFooter: FC<{
  activeStep: VALIDATION_STEP;
  canConfirm: boolean;
  hasFile: boolean;
  onBack: () => void;
  onClose: () => void;
  onImport: () => void;
  onNext: () => void;
}> = ({
  activeStep,
  canConfirm,
  hasFile,
  onBack,
  onClose,
  onImport,
  onNext,
}) => {
  const { t } = useTranslation();

  return (
    <Box
      className="tw:shrink-0 tw:border-t tw:border-secondary tw:bg-primary tw:px-6 tw:py-4"
      data-testid="members-import-footer"
      direction="row"
      gap={3}
      justify="end">
      {activeStep === VALIDATION_STEP.EDIT_VALIDATE && (
        <Button color="secondary" data-testid="back-import" onPress={onBack}>
          {t('label.back')}
        </Button>
      )}
      {activeStep === VALIDATION_STEP.UPLOAD && (
        <>
          <Button
            color="tertiary"
            data-testid="cancel-import"
            onPress={onClose}>
            {t('label.cancel')}
          </Button>
          <Button
            color="primary"
            data-testid="next-preview"
            iconTrailing={ChevronRight}
            isDisabled={!hasFile}
            onPress={onNext}>
            {`${t('label.next')}: ${t('label.preview')}`}
          </Button>
        </>
      )}
      {canConfirm && (
        <Button color="primary" data-testid="confirm-import" onPress={onImport}>
          {t('label.import')}
        </Button>
      )}
      {activeStep === VALIDATION_STEP.UPDATE && (
        <Button color="primary" data-testid="view-import" onPress={onClose}>
          {t('label.view')}
        </Button>
      )}
    </Box>
  );
};

const PREVIEW_PROGRESS_NO_JOB = 45;
const PREVIEW_PROGRESS_RUNNING = 78;
const PREVIEW_PROGRESS_QUEUED = 62;

const MembersImportForm: FC<MembersImportFormProps> = ({
  fqn,
  importType,
  onClose,
}) => {
  const { t } = useTranslation();
  const { socket } = useWebSocketConnector();

  const [selectedFile, setSelectedFile] = useState<SelectedCsvFile>();
  const [csvImportResult, setCsvImportResult] = useState<CSVImportResult>();
  const [activeStep, setActiveStep] = useState<VALIDATION_STEP>(
    VALIDATION_STEP.UPLOAD
  );
  const [processingType, setProcessingType] = useState<ProcessingType>();
  const [activeJob, setActiveJob] = useState<ActiveJob>();
  const activeJobRef = useRef<CSVImportJobType>();

  const entity = importType === 'users' ? t('label.user') : t('label.team');

  const getRowCountLabel = useCallback(
    (rowCount: number) =>
      `${rowCount} ${t(rowCount === 1 ? 'label.row' : 'label.row-plural')
        .toLowerCase()
        .trim()}`,
    [t]
  );

  const runImport = useCallback(
    (data: string, dryRun: boolean) =>
      importType === 'users'
        ? importUserInTeam(fqn, data, dryRun)
        : importTeam(fqn, data, dryRun),
    [fqn, importType]
  );

  const handleDropFiles = useCallback(
    async (files: FileList) => {
      const file = files[0];
      if (!file) {
        return;
      }
      try {
        const content = await file.text();
        setSelectedFile({
          content,
          name: file.name,
          rowCount: getCsvRowCount(content),
          sizeLabel: getCsvFileSizeLabel(file.size),
        });
        setCsvImportResult(undefined);
      } catch {
        showErrorToast(t('server.unexpected-error'));
      }
    },
    [t]
  );

  const handleUnsupportedFile = useCallback(
    () => showErrorToast(t('message.invalid-file-format', { formats: '.csv' })),
    [t]
  );

  const handleStartPreview = useCallback(async () => {
    if (!selectedFile) {
      return;
    }
    setProcessingType('preview');
    setActiveJob({});
    try {
      const response = await runImport(selectedFile.content, true);
      activeJobRef.current = {
        ...response,
        type: 'initialLoad',
        initialResult: selectedFile.content,
      };
      setActiveJob({ jobId: response.jobId });
    } catch (error) {
      showErrorToast(error as AxiosError);
      setProcessingType(undefined);
    }
  }, [runImport, selectedFile]);

  const handleImport = useCallback(async () => {
    if (!selectedFile) {
      return;
    }
    setProcessingType('import');
    setActiveStep(VALIDATION_STEP.UPDATE);
    setActiveJob({});
    try {
      const response = await runImport(selectedFile.content, false);
      activeJobRef.current = { ...response, type: 'onValidate' };
      setActiveJob({ jobId: response.jobId });
    } catch (error) {
      showErrorToast(error as AxiosError);
      setProcessingType(undefined);
      setActiveStep(VALIDATION_STEP.EDIT_VALIDATE);
    }
  }, [runImport, selectedFile]);

  const handleBack = useCallback(() => {
    setCsvImportResult(undefined);
    setActiveStep(VALIDATION_STEP.UPLOAD);
  }, []);

  const handleRetryUpload = useCallback(() => {
    setCsvImportResult(undefined);
    setSelectedFile(undefined);
    setProcessingType(undefined);
    setActiveJob(undefined);
    setActiveStep(VALIDATION_STEP.UPLOAD);
  }, []);

  useEffect(() => {
    if (!socket) {
      return;
    }
    // Keep a stable reference so cleanup removes only THIS listener — a bare
    // socket.off(channel) would also drop the app-wide CsvJobsTray subscription.
    const handleCsvImportChannel = (payload: string) => {
      if (!payload) {
        return;
      }
      const response = JSON.parse(payload) as CSVImportAsyncWebsocketResponse;
      const job = activeJobRef.current;
      if (response.jobId !== job?.jobId) {
        return;
      }
      setActiveJob({ jobId: response.jobId, status: response.status });
      // A FAILED job must clear the spinner and drop back to an actionable step,
      // otherwise the form hangs on the ProcessingBanner with no footer/retry.
      if (response.status === 'FAILED') {
        showErrorToast(response.error ?? t('server.unexpected-error'));
        setProcessingType(undefined);
        setActiveStep(
          job.type === 'initialLoad'
            ? VALIDATION_STEP.UPLOAD
            : VALIDATION_STEP.EDIT_VALIDATE
        );
        activeJobRef.current = undefined;

        return;
      }
      if (response.status !== 'COMPLETED') {
        return;
      }
      setCsvImportResult(response.result);
      setProcessingType(undefined);
      // An aborted dry-run keeps the user on the upload step so the abort card
      // can offer a retry; a clean one advances to preview.
      if (
        job.type === 'initialLoad' &&
        response.result?.status !== Status.Aborted
      ) {
        setActiveStep(VALIDATION_STEP.EDIT_VALIDATE);
      }
      activeJobRef.current = undefined;
    };

    socket.on(SOCKET_EVENTS.CSV_IMPORT_CHANNEL, handleCsvImportChannel);

    return () => {
      socket.off(SOCKET_EVENTS.CSV_IMPORT_CHANNEL, handleCsvImportChannel);
    };
  }, [socket, t]);

  const previewProgress = useMemo(() => {
    if (!activeJob?.jobId) {
      return PREVIEW_PROGRESS_NO_JOB;
    }

    return activeJob.status === 'IN_PROGRESS'
      ? PREVIEW_PROGRESS_RUNNING
      : PREVIEW_PROGRESS_QUEUED;
  }, [activeJob?.jobId, activeJob?.status]);

  const previewStages = useMemo<
    { key: string; label: string; state: StageState }[]
  >(
    () => [
      {
        key: 'reading',
        label: t('message.import-csv-reading-file'),
        state: 'done',
      },
      {
        key: 'parsing',
        label: t('message.import-csv-parsing-rows'),
        state: activeJob?.jobId ? 'done' : 'active',
      },
      {
        key: 'validating',
        label: t('message.import-csv-validating-catalog'),
        state: activeJob?.jobId ? 'active' : 'pending',
      },
      {
        key: 'preview',
        label: t('message.import-csv-building-preview'),
        state: activeJob?.status === 'COMPLETED' ? 'active' : 'pending',
      },
    ],
    [activeJob?.jobId, activeJob?.status, t]
  );

  const isAborted = csvImportResult?.status === Status.Aborted;
  const canConfirmImport =
    activeStep === VALIDATION_STEP.EDIT_VALIDATE &&
    csvImportResult?.status !== Status.Failure &&
    !isAborted;
  const fileName = selectedFile?.name ?? t('label.csv');
  const rowCountLabel = getRowCountLabel(selectedFile?.rowCount ?? 0);
  const isProcessing = Boolean(processingType);

  const renderUpdateBody = () => {
    if (isAborted) {
      return (
        <AbortCard
          reason={csvImportResult?.abortReason}
          onBack={handleRetryUpload}
        />
      );
    }

    // A completed import that didn't fully succeed shows the result table with
    // per-row failures, not a false "imported successfully" screen.
    if (csvImportResult && csvImportResult.status !== Status.Success) {
      return <PreviewContent result={csvImportResult} />;
    }

    return (
      <SuccessContent entity={entity} fileName={selectedFile?.name ?? ''} />
    );
  };

  const renderBody = () => {
    if (processingType === 'preview') {
      return (
        <ProcessingBanner
          fileName={fileName}
          progress={previewProgress}
          rowCountLabel={rowCountLabel}
          stages={previewStages}
          title={t('message.import-csv-processing-title')}
        />
      );
    }

    if (processingType === 'import') {
      return (
        <ProcessingBanner
          fileName={fileName}
          progress={previewProgress}
          rowCountLabel={rowCountLabel}
          title={t('message.importing-entity', { entity })}
        />
      );
    }

    if (activeStep === VALIDATION_STEP.UPLOAD) {
      return isAborted ? (
        <AbortCard
          reason={csvImportResult?.abortReason}
          onBack={handleRetryUpload}
        />
      ) : (
        <UploadStep
          entity={entity}
          rowCountLabel={rowCountLabel}
          selectedFile={selectedFile}
          onDropFiles={handleDropFiles}
          onRemove={() => setSelectedFile(undefined)}
          onUnsupported={handleUnsupportedFile}
        />
      );
    }

    if (activeStep === VALIDATION_STEP.EDIT_VALIDATE && csvImportResult) {
      return <PreviewContent result={csvImportResult} />;
    }

    if (activeStep === VALIDATION_STEP.UPDATE) {
      return renderUpdateBody();
    }

    return null;
  };

  return (
    <Box className="tw:h-full tw:min-h-0" direction="col" justify="between">
      <Box
        className="tw:flex-1 tw:overflow-y-auto tw:px-8 tw:pb-8 tw:pt-2"
        data-testid="members-import-container"
        direction="col"
        gap={6}>
        <ImportStepper activeStep={activeStep} />
        {renderBody()}
      </Box>

      {!isProcessing && !isAborted && (
        <ImportFooter
          activeStep={activeStep}
          canConfirm={canConfirmImport}
          hasFile={Boolean(selectedFile)}
          onBack={handleBack}
          onClose={onClose}
          onImport={handleImport}
          onNext={handleStartPreview}
        />
      )}
    </Box>
  );
};

export default MembersImportForm;
