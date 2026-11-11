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
  CloseButton,
  Dialog,
  FileTrigger,
  FileUpload,
  getReadableFileSize,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  Dispatch,
  MutableRefObject,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import type { NativeOntologyImportSummary } from '../../../../generated/api/data/nativeOntologyImportSummary';
import type { Ontology } from '../../../../generated/entity/data/ontology';
import { Operation } from '../../../../generated/entity/policies/policy';
import { useAuth } from '../../../../hooks/authHooks';
import {
  NativeInstallTarget,
  useNativeOntologyInstall,
} from '../../../../hooks/governance/ontology/useNativeOntologyInstall';
import { ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY } from '../../../../hooks/governance/ontology/useOntologyStudioScopes';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { previewNativeOntologyImport } from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { checkPermission } from '../../../../utils/PermissionsUtils';
import { getErrorText } from '../../../../utils/StringUtils';
import { showSuccessToast } from '../../../../utils/ToastUtils';
import { GeneratedOntologyIdentity } from '../OntologyCreateForm/OntologyCreateForm.utils';
import { useOntologyIdentitySource } from '../OntologyCreateForm/useOntologyIdentitySource';
import { resolveNativeLibraryTarget } from '../OntologyNativeLibraryDetail/OntologyNativeLibraryDetail.utils';
import OntologyNativeImportItems from './OntologyNativeImportItems';
import {
  canApplyImport,
  detectedFormatOf,
  detectNativeImportFile,
  hasReviewers,
  importBusyOf,
  importItemsOf,
  importSummaryParts,
  INITIAL_NATIVE_IMPORT_STATE,
  isFileChoiceDisabled,
  isNewImportTarget,
  isSelectableItem,
  itemImportCount,
  landOnImportedOntology,
  NativeImportAction,
  nativeImportErrorMessage,
  nativeImportOntologyRequest,
  NativeImportParse,
  nativeImportReducer,
  NativeImportState,
  NativeImportTarget,
  NATIVE_IMPORT_ACCEPTED_EXTENSIONS,
  NATIVE_IMPORT_FORMAT_LABEL_KEYS,
  NATIVE_IMPORT_MAX_BYTES,
  parseNativeImportFile,
  pick,
  readySummaryOf,
  selectChanges,
  selectionOf,
} from './OntologyNativeImportPanel.utils';
import OntologyNativeImportSkipped from './OntologyNativeImportSkipped';

interface OntologyNativeImportPanelProps {
  readonly canImport: boolean;
  /** Offers a new ontology as the target besides `ontology`; without `ontology` the target is always new. */
  readonly isTargetSelectable?: boolean;
  readonly ontology?: Ontology;
  readonly onApplied: () => void;
  readonly onBusyChange?: (isBusy: boolean) => void;
  readonly onCancel: () => void;
}

const NEW_TARGET_KEY = 'new';

const ImportOutcome = ({
  summary,
  isNewTarget,
  hasReviewers,
}: {
  readonly summary: NativeOntologyImportSummary;
  readonly isNewTarget: boolean;
  readonly hasReviewers: boolean;
}) => {
  const { t } = useTranslation();

  return (
    <>
      {isNewTarget && summary.ontologyLabel && (
        <Typography color="secondary" size="text-sm">
          {t('message.native-import-new-ontology-named', {
            name: summary.ontologyLabel,
          })}
        </Typography>
      )}
      {hasReviewers && (
        <Alert
          data-testid="ontology-native-import-draft-notice"
          variant="brand">
          {t('message.native-import-enters-draft')}
        </Alert>
      )}
    </>
  );
};

const fileExtensionOf = (fileName: string) => {
  const dot = fileName.lastIndexOf('.');

  return dot > 0 ? fileName.slice(dot + 1).toUpperCase() : '';
};

const ImportFileCard = ({
  isDisabled,
  state,
  onClear,
  onReplace,
}: {
  readonly isDisabled: boolean;
  readonly state: NativeImportState;
  readonly onClear: () => void;
  readonly onReplace: (files: FileList | null) => void;
}) => {
  const { t } = useTranslation();
  const format = detectedFormatOf(state);
  const summary = readySummaryOf(state);
  const items = summary ? importItemsOf(summary) : [];
  const details = [
    state.fileSize === undefined
      ? undefined
      : getReadableFileSize(state.fileSize),
    items.length > 0
      ? t('message.native-import-items-found', {
          count: items.length,
          skipped: items.filter((item) => !isSelectableItem(item)).length,
        })
      : undefined,
  ].filter(Boolean);

  return (
    <Box
      align="center"
      className="tw:rounded-xl tw:border tw:border-secondary tw:p-4"
      data-testid="ontology-native-import-file-card"
      gap={3}>
      <Box
        align="center"
        className="tw:size-10 tw:shrink-0 tw:rounded-lg tw:border tw:border-brand tw:bg-brand-primary tw:text-xs tw:font-semibold tw:text-brand-secondary"
        justify="center">
        {fileExtensionOf(state.fileName ?? '')}
      </Box>
      <Box className="tw:min-w-0 tw:flex-1" direction="col">
        <Box align="center" gap={2}>
          <Typography
            className="tw:break-words"
            data-testid="ontology-native-import-file-name"
            weight="medium">
            {state.fileName}
          </Typography>
          {format && (
            <Badge color="brand" data-testid="ontology-native-import-format">
              {t(NATIVE_IMPORT_FORMAT_LABEL_KEYS[format])}
            </Badge>
          )}
        </Box>
        {details.length > 0 && (
          <Typography
            color="secondary"
            data-testid="ontology-native-import-items-found"
            size="text-sm">
            {details.join(' · ')}
          </Typography>
        )}
      </Box>
      <FileTrigger
        acceptedFileTypes={NATIVE_IMPORT_ACCEPTED_EXTENSIONS.split(',')}
        onSelect={onReplace}>
        <Button
          color="link-color"
          data-testid="ontology-native-import-replace"
          isDisabled={isDisabled}
          size="sm">
          {t('label.replace')}
        </Button>
      </FileTrigger>
      <CloseButton
        data-testid="ontology-native-import-clear"
        isDisabled={isDisabled}
        label={t('label.remove')}
        size="sm"
        onPress={onClear}
      />
    </Box>
  );
};

const ImportFileStep = ({
  state,
  isDisabled,
  onClear,
  onFile,
  onReplace,
  onSizeLimitExceed,
}: {
  readonly state: NativeImportState;
  readonly isDisabled: boolean;
  readonly onClear: () => void;
  readonly onFile: (files: FileList) => void;
  readonly onReplace: (files: FileList | null) => void;
  readonly onSizeLimitExceed: () => void;
}) => {
  const { t } = useTranslation();
  const isUndetected =
    state.detection.kind === 'ready' && !detectedFormatOf(state);

  if (!state.fileName) {
    return (
      <FileUpload.DropZone
        accept={NATIVE_IMPORT_ACCEPTED_EXTENSIONS}
        allowsMultiple={false}
        clickToUploadLabel={t('label.click-to-upload')}
        data-testid="ontology-native-import-file"
        hint={t('message.native-import-supported-formats')}
        isDisabled={isDisabled}
        maxSize={NATIVE_IMPORT_MAX_BYTES}
        orDragAndDropLabel={t('label.or-drag-and-drop')}
        onDropFiles={onFile}
        onSizeLimitExceed={onSizeLimitExceed}
      />
    );
  }

  return (
    <>
      <ImportFileCard
        isDisabled={isDisabled}
        state={state}
        onClear={onClear}
        onReplace={onReplace}
      />
      {isUndetected && (
        <Alert variant="warning">
          {t('message.native-import-format-undetected')}
        </Alert>
      )}
    </>
  );
};

const ImportButton = ({
  canImport,
  importCount,
  isImporting,
  isLocked,
  onImport,
}: {
  readonly canImport: boolean;
  readonly importCount?: number;
  readonly isImporting: boolean;
  readonly isLocked: boolean;
  readonly onImport: () => void;
}) => {
  const { t } = useTranslation();
  let label = t('label.import-change-count', { count: importCount });
  if (isLocked) {
    label = t('label.retry');
  } else if (importCount === undefined) {
    label = t('label.import');
  }

  return (
    <Button
      color="primary"
      data-testid="ontology-native-import-apply"
      isDisabled={!canImport}
      isLoading={isImporting}
      onPress={onImport}>
      {label}
    </Button>
  );
};

const ImportFooterSummary = ({
  selection,
  summary,
}: {
  readonly selection: ReadonlySet<string>;
  readonly summary?: NativeOntologyImportSummary;
}) => {
  const { t } = useTranslation();
  const parts = summary ? importSummaryParts(summary, selection) : [];
  let text = t('message.ontology-import-supported-files');
  if (summary) {
    text =
      parts.length > 0
        ? t('message.native-import-saved-as-draft', {
            changes: parts
              .map(({ part, count }) =>
                t(`message.native-import-count-${part}`, { count })
              )
              .join(', '),
          })
        : t('message.native-import-nothing-selected');
  }

  return (
    <Typography
      className="tw:mr-auto tw:self-center"
      color="secondary"
      data-testid="ontology-native-import-summary"
      size="text-sm">
      {text}
    </Typography>
  );
};

const ImportTargetSelect = ({
  canCreate,
  isDisabled,
  isNewTarget,
  ontology,
  onChange,
}: {
  readonly canCreate: boolean;
  readonly isDisabled: boolean;
  readonly isNewTarget: boolean;
  readonly ontology?: Ontology;
  readonly onChange: (target: NativeImportTarget) => void;
}) => {
  const { t } = useTranslation();

  return (
    <Select
      data-testid="ontology-native-import-target"
      isDisabled={isDisabled}
      label={t('label.import-into')}
      selectedKey={isNewTarget ? NEW_TARGET_KEY : ontology?.id}
      onSelectionChange={(key) =>
        onChange(key === NEW_TARGET_KEY ? 'new' : 'existing')
      }>
      {ontology ? (
        <Select.Item id={ontology.id} label={getEntityName(ontology)} />
      ) : null}
      <Select.Item
        id={NEW_TARGET_KEY}
        isDisabled={!canCreate}
        label={t('label.new-ontology')}
      />
    </Select>
  );
};

const ImportIntro = ({
  canCreate,
  isDisabled,
  isNewTarget,
  isTargetSelectable,
  ontology,
  onTargetChange,
}: {
  readonly canCreate: boolean;
  readonly isDisabled: boolean;
  readonly isNewTarget: boolean;
  readonly isTargetSelectable: boolean;
  readonly ontology?: Ontology;
  readonly onTargetChange: (target: NativeImportTarget) => void;
}) => {
  const { t } = useTranslation();

  return (
    <>
      <Typography color="secondary" size="text-sm">
        {isNewTarget
          ? t('message.native-ontology-import-help')
          : t('message.ontology-import-into-help')}
      </Typography>
      {(isTargetSelectable || !ontology) && (
        <ImportTargetSelect
          canCreate={canCreate}
          isDisabled={isDisabled}
          isNewTarget={isNewTarget}
          ontology={ontology}
          onChange={onTargetChange}
        />
      )}
    </>
  );
};

const describeError = (error: unknown, fallback: string) =>
  isAxiosError(error) ? getErrorText(error, fallback) : fallback;

const useCanCreateOntology = () => {
  const { isAdminUser } = useAuth();
  const { permissions } = usePermissionProvider();
  const currentUserId = useApplicationStore((store) => store.currentUser?.id);
  const canCreate =
    (Boolean(isAdminUser) ||
      checkPermission(
        Operation.Create,
        ResourceEntity.ONTOLOGY,
        permissions
      )) &&
    Boolean(currentUserId);

  return { canCreate, currentUserId };
};

const useNativeImportInstall = ({
  canCreate,
  content,
  isNewTarget,
  parse,
  fileName,
  onApplied,
}: {
  readonly canCreate: boolean;
  readonly content: MutableRefObject<string>;
  readonly isNewTarget: boolean;
  readonly parse: NativeImportParse;
  readonly fileName?: string;
  readonly onApplied: () => void;
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [, setSearchParams] = useSearchParams();

  return useNativeOntologyInstall({
    canCreate,
    resolveNew: resolveNativeLibraryTarget,
    plan: async (resolved) => {
      if (!isNewTarget && parse.kind === 'ready' && parse.changeSet) {
        return selectChanges(parse.changeSet, parse.summary, parse.selection);
      }
      const preview = await previewNativeOntologyImport(resolved.id, {
        data: content.current,
        fileName,
      });

      return parse.kind === 'ready'
        ? selectChanges(preview.changeSet, preview.summary, parse.selection)
        : preview.changeSet;
    },
    onInstalled: (installed) => {
      showSuccessToast(t('label.ontology-applied'));
      if (isNewTarget) {
        void queryClient.invalidateQueries({
          queryKey: [ONTOLOGY_STUDIO_ONTOLOGIES_QUERY_KEY],
        });
        setSearchParams((current) =>
          landOnImportedOntology(current, installed.id)
        );
      }
      onApplied();
    },
  });
};

const nativeImportInstallTarget = (
  state: NativeImportState,
  ontology: Ontology | undefined,
  userId: string | undefined,
  identityOf: (title: string) => GeneratedOntologyIdentity | undefined
): NativeInstallTarget | undefined => {
  if (state.parse.kind !== 'ready' || !state.fileName) {
    return undefined;
  }
  if (ontology) {
    return { kind: 'existing', ontology };
  }

  return userId
    ? {
        kind: 'new',
        request: nativeImportOntologyRequest(
          state.parse.summary.ontologyLabel,
          state.fileName,
          userId,
          identityOf
        ),
      }
    : undefined;
};

const useNativeImportFileChoice = ({
  content,
  describe,
  dispatch,
  isLocked,
  nextToken,
  onDetected,
}: {
  readonly content: MutableRefObject<string>;
  readonly describe: (error: unknown) => string;
  readonly dispatch: Dispatch<NativeImportAction>;
  readonly isLocked: boolean;
  readonly nextToken: () => number;
  readonly onDetected: (fileName: string) => void;
}) => {
  const { t } = useTranslation();
  const fileToken = useRef(0);

  const handleFile = async (files: FileList) => {
    const file = files[0];
    if (!file || isLocked) {
      return;
    }
    const fileId = nextToken();
    fileToken.current = fileId;
    content.current = '';
    dispatch({
      type: 'fileChosen',
      token: fileId,
      fileName: file.name,
      fileSize: file.size,
    });
    const { text, format } = await detectNativeImportFile(
      file,
      fileId,
      dispatch,
      describe
    );
    if (fileToken.current !== fileId) {
      return;
    }
    content.current = text;
    if (format) {
      onDetected(file.name);
    }
  };

  const clearFile = () => {
    const fileId = nextToken();
    fileToken.current = fileId;
    content.current = '';
    dispatch({ type: 'fileCleared', token: fileId });
  };

  const rejectOversizedFile = () => {
    const fileId = nextToken();
    fileToken.current = fileId;
    content.current = '';
    dispatch({
      type: 'fileRejected',
      token: fileId,
      message: t('message.file-size-exceeded', { size: '10 MB' }),
    });
  };

  // FileTrigger has no size limit of its own, unlike the classic drop zone.
  const handleSelectedFile = (files: FileList | null) => {
    if (!files?.length) {
      return;
    }
    if (files[0].size > NATIVE_IMPORT_MAX_BYTES) {
      rejectOversizedFile();

      return;
    }
    void handleFile(files);
  };

  return { clearFile, handleFile, handleSelectedFile, rejectOversizedFile };
};

const ImportReview = ({
  hasReviewers: hasReviewerGate,
  isDisabled,
  isNewTarget,
  selection,
  summary,
  onSelectionChange,
}: {
  readonly hasReviewers: boolean;
  readonly isDisabled: boolean;
  readonly isNewTarget: boolean;
  readonly selection: ReadonlySet<string>;
  readonly summary: NativeOntologyImportSummary;
  readonly onSelectionChange: (selection: ReadonlySet<string>) => void;
}) => {
  const items = importItemsOf(summary);

  return (
    <Box data-testid="ontology-native-import-result" direction="col" gap={4}>
      <ImportOutcome
        hasReviewers={hasReviewerGate}
        isNewTarget={isNewTarget}
        summary={summary}
      />
      {summary.skippedStatements && summary.skippedStatements.total > 0 && (
        <OntologyNativeImportSkipped skipped={summary.skippedStatements} />
      )}
      {(items.length > 0 || (summary.omittedItems ?? 0) > 0) && (
        <OntologyNativeImportItems
          hasSummary={false}
          isDisabled={isDisabled}
          items={items}
          omittedItems={summary.omittedItems ?? 0}
          selection={selection}
          onSelectionChange={onSelectionChange}
        />
      )}
    </Box>
  );
};

const ImportErrors = ({ message }: { readonly message?: string }) =>
  message ? <Alert variant="error">{message}</Alert> : null;

const ImportReading = ({
  fileName,
  isParsing,
}: {
  readonly fileName?: string;
  readonly isParsing: boolean;
}) => {
  const { t } = useTranslation();

  if (!isParsing || !fileName) {
    return null;
  }

  return (
    <Typography
      color="secondary"
      data-testid="ontology-native-import-reading"
      role="status"
      size="text-sm">
      {t('message.native-import-reading-file', { fileName })}
    </Typography>
  );
};

const OntologyNativeImportPanel = ({
  canImport,
  isTargetSelectable = false,
  ontology,
  onApplied,
  onBusyChange,
  onCancel,
}: OntologyNativeImportPanelProps) => {
  const { t } = useTranslation();
  const { canCreate, currentUserId } = useCanCreateOntology();
  const {
    identityOf,
    refreshIdentityOf,
    isReady: isIdentityReady,
  } = useOntologyIdentitySource(!ontology || canCreate);
  const [state, dispatch] = useReducer(nativeImportReducer, {
    ...INITIAL_NATIVE_IMPORT_STATE,
    target: ontology ? 'existing' : 'new',
  });
  const content = useRef('');
  const token = useRef(0);
  const nextToken = () => ++token.current;
  const isNewTarget = isNewImportTarget(state, ontology);
  const canUseTarget = pick(isNewTarget, canCreate, canImport);
  const unexpected = t('server.unexpected-error');

  const install = useNativeImportInstall({
    canCreate,
    content,
    isNewTarget,
    parse: state.parse,
    fileName: state.fileName,
    onApplied,
  });

  const { isBusy, isParsing } = importBusyOf(state, install.isBusy);
  useEffect(() => {
    onBusyChange?.(isBusy);
  }, [isBusy, onBusyChange]);

  const describe = (error: unknown) => describeError(error, unexpected);

  // The preview is a dry run, so it starts as soon as the file's format is known.
  const parse = async (fileName: string, isNew: boolean) => {
    if (!pick(isNew, canCreate, canImport)) {
      return;
    }
    const parseId = nextToken();
    dispatch({ type: 'parseStarted', token: parseId });
    await parseNativeImportFile(
      { data: content.current, fileName },
      parseId,
      isNew ? undefined : ontology,
      dispatch,
      describe
    );
  };

  const { clearFile, handleFile, handleSelectedFile, rejectOversizedFile } =
    useNativeImportFileChoice({
      content,
      describe,
      dispatch,
      isLocked: install.isLocked,
      nextToken,
      onDetected: (fileName) => void parse(fileName, isNewTarget),
    });

  const changeTarget = (target: NativeImportTarget) => {
    dispatch({ type: 'targetChanged', token: nextToken(), target });
    if (state.fileName && detectedFormatOf(state) && target !== state.target) {
      void parse(state.fileName, target === 'new' || !ontology);
    }
  };

  const handleImport = async () => {
    const target = nativeImportInstallTarget(
      state,
      isNewTarget ? undefined : ontology,
      currentUserId,
      isNewTarget ? await refreshIdentityOf() : identityOf
    );
    if (target) {
      void install.start(target);
    }
  };

  const readySummary = readySummaryOf(state);
  const isLockedOrBusy = install.isLocked || isBusy;
  const selection = selectionOf(state.parse);

  return (
    <>
      <Dialog.Content>
        <ImportIntro
          canCreate={canCreate}
          isDisabled={isLockedOrBusy}
          isNewTarget={isNewTarget}
          isTargetSelectable={isTargetSelectable}
          ontology={ontology}
          onTargetChange={changeTarget}
        />
        <ImportFileStep
          isDisabled={isFileChoiceDisabled(isLockedOrBusy, canUseTarget)}
          state={state}
          onClear={clearFile}
          onFile={(files) => void handleFile(files)}
          onReplace={handleSelectedFile}
          onSizeLimitExceed={rejectOversizedFile}
        />
        <ImportReading fileName={state.fileName} isParsing={isParsing} />
        {readySummary && (
          <ImportReview
            hasReviewers={!isNewTarget && hasReviewers(ontology)}
            isDisabled={isLockedOrBusy}
            isNewTarget={isNewTarget}
            selection={selection}
            summary={readySummary}
            onSelectionChange={(next) =>
              dispatch({
                type: 'selectionChanged',
                parseId: state.parseId,
                selection: next,
              })
            }
          />
        )}
        <ImportErrors
          message={nativeImportErrorMessage(state, install.error)}
        />
      </Dialog.Content>
      <Dialog.Footer>
        <ImportFooterSummary selection={selection} summary={readySummary} />
        <Button
          color="secondary"
          data-testid="ontology-native-import-cancel"
          isDisabled={isBusy}
          onPress={onCancel}>
          {t('label.cancel')}
        </Button>
        <ImportButton
          canImport={canApplyImport(state, {
            canUseTarget,
            isBusy,
            isIdentityReady,
          })}
          importCount={readySummary && itemImportCount(readySummary, selection)}
          isImporting={install.isBusy}
          isLocked={install.isLocked}
          onImport={() => void handleImport()}
        />
      </Dialog.Footer>
    </>
  );
};

export default OntologyNativeImportPanel;
