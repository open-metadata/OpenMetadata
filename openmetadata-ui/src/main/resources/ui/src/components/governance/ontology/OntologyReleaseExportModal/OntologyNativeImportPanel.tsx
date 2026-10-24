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
  FileUpload,
  ProgressSteps,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { MutableRefObject, useEffect, useReducer, useRef } from 'react';
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
import { resolveNativeLibraryTarget } from '../OntologyNativeLibraryDetail/OntologyNativeLibraryDetail.utils';
import {
  detectNativeImportFile,
  hasReviewers,
  INITIAL_NATIVE_IMPORT_STATE,
  landOnImportedOntology,
  nativeImportActionFlags,
  nativeImportErrorMessage,
  nativeImportOntologyRequest,
  NativeImportParse,
  nativeImportReducer,
  NativeImportState,
  nativeImportStep,
  NativeImportTarget,
  NATIVE_IMPORT_ACCEPTED_EXTENSIONS,
  NATIVE_IMPORT_FORMAT_LABEL_KEYS,
  NATIVE_IMPORT_MAX_BYTES,
  parseNativeImportFile,
  pick,
  readySummaryOf,
} from './OntologyNativeImportPanel.utils';

interface OntologyNativeImportPanelProps {
  readonly canImport: boolean;
  readonly ontology?: Ontology;
  readonly onApplied: () => void;
  readonly onBusyChange?: (isBusy: boolean) => void;
}

const STEP_INDEX = { drop: 0, parse: 1, import: 2 } as const;
const NEW_TARGET_KEY = 'new';
const COUNT_TILES = [
  {
    id: 'new-concepts',
    label: 'label.new-concept-plural',
    count: 'newConcepts',
  },
  { id: 'relations', label: 'label.relation-plural', count: 'newRelations' },
  {
    id: 'new-properties',
    label: 'label.property-plural',
    count: 'newProperties',
  },
  { id: 'mappings', label: 'label.mapping-plural', count: 'newMappings' },
  { id: 'skipped', label: 'label.skipped', count: 'skippedDefinitions' },
] as const;

const ImportResult = ({
  summary,
  isNewTarget,
  hasReviewers,
}: {
  readonly summary: NativeOntologyImportSummary;
  readonly isNewTarget: boolean;
  readonly hasReviewers: boolean;
}) => {
  const { t } = useTranslation();
  const { counts, ontologyLabel } = summary;
  const hasOtherChanges =
    counts.updatedConcepts +
      counts.updatedProperties +
      counts.skippedRelations >
    0;

  return (
    <Box data-testid="ontology-native-import-result" direction="col" gap={3}>
      <Typography weight="semibold">
        {t('message.native-import-nothing-persisted')}
      </Typography>
      {isNewTarget && ontologyLabel && (
        <Typography color="secondary" size="text-sm">
          {t('message.native-import-new-ontology-named', {
            name: ontologyLabel,
          })}
        </Typography>
      )}
      <Box gap={3}>
        {COUNT_TILES.map((tile) => (
          <Card className="tw:flex-1" key={tile.id} size="sm" variant="muted">
            <Card.Content>
              <Typography
                as="div"
                data-testid={`ontology-native-import-count-${tile.id}`}
                size="text-xl"
                weight="semibold">
                {counts[tile.count]}
              </Typography>
              <Typography color="secondary" size="text-xs">
                {tile.id === 'new-properties'
                  ? `${t('label.new')} ${t(tile.label)}`
                  : t(tile.label)}
              </Typography>
            </Card.Content>
          </Card>
        ))}
      </Box>
      {hasOtherChanges && (
        <Typography
          color="secondary"
          data-testid="ontology-native-import-also"
          size="text-sm">
          {t('message.native-import-also', {
            updatedConcepts: counts.updatedConcepts,
            updatedProperties: counts.updatedProperties,
            skippedRelations: counts.skippedRelations,
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
    </Box>
  );
};

const ImportFileStep = ({
  state,
  isDisabled,
  onFile,
  onSizeLimitExceed,
}: {
  readonly state: NativeImportState;
  readonly isDisabled: boolean;
  readonly onFile: (files: FileList) => void;
  readonly onSizeLimitExceed: () => void;
}) => {
  const { t } = useTranslation();
  const format =
    state.detection.kind === 'ready' ? state.detection.format : undefined;
  const isUndetected = state.detection.kind === 'ready' && !format;

  return (
    <>
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
      {state.fileName && (
        <Box align="center" gap={2}>
          <Typography data-testid="ontology-native-import-file-name">
            {state.fileName}
          </Typography>
          {format && (
            <Badge color="brand" data-testid="ontology-native-import-format">
              {t(NATIVE_IMPORT_FORMAT_LABEL_KEYS[format])}
            </Badge>
          )}
        </Box>
      )}
      {isUndetected && (
        <Alert variant="warning">
          {t('message.native-import-format-undetected')}
        </Alert>
      )}
    </>
  );
};

const ImportActions = ({
  canParse,
  canImport,
  isImporting,
  isLocked,
  isParsed,
  isParsing,
  onImport,
  onParse,
}: {
  readonly canParse: boolean;
  readonly canImport: boolean;
  readonly isImporting: boolean;
  readonly isLocked: boolean;
  readonly isParsed: boolean;
  readonly isParsing: boolean;
  readonly onImport: () => void;
  readonly onParse: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <Box gap={2}>
      {!isParsed && (
        <Button
          color="secondary"
          data-testid="ontology-native-import-parse"
          isDisabled={!canParse}
          isLoading={isParsing}
          onPress={onParse}>
          {t('label.parse')}
        </Button>
      )}
      <Button
        color="primary"
        data-testid="ontology-native-import-apply"
        isDisabled={!canImport}
        isLoading={isImporting}
        onPress={onImport}>
        {isLocked ? t('label.retry') : t('label.import')}
      </Button>
    </Box>
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
        return parse.changeSet;
      }
      const preview = await previewNativeOntologyImport(resolved.id, {
        data: content.current,
        fileName,
      });

      return preview.changeSet;
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
  userId: string | undefined
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
          userId
        ),
      }
    : undefined;
};

const OntologyNativeImportPanel = ({
  canImport,
  ontology,
  onApplied,
  onBusyChange,
}: OntologyNativeImportPanelProps) => {
  const { t } = useTranslation();
  const { canCreate, currentUserId } = useCanCreateOntology();
  const [state, dispatch] = useReducer(nativeImportReducer, {
    ...INITIAL_NATIVE_IMPORT_STATE,
    target: ontology ? 'existing' : 'new',
  });
  const content = useRef('');
  const token = useRef(0);
  const fileToken = useRef(0);
  const nextToken = () => ++token.current;
  const isNewTarget = state.target === 'new' || !ontology;
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

  const isParsing = state.parse.kind === 'pending';
  const isBusy = isParsing || install.isBusy;
  useEffect(() => {
    onBusyChange?.(isBusy);
  }, [isBusy, onBusyChange]);

  const describe = (error: unknown) => describeError(error, unexpected);

  const handleFile = async (files: FileList) => {
    const file = files[0];
    if (!file || install.isLocked) {
      return;
    }
    const fileId = nextToken();
    fileToken.current = fileId;
    content.current = '';
    dispatch({ type: 'fileChosen', token: fileId, fileName: file.name });
    const text = await detectNativeImportFile(file, fileId, dispatch, describe);
    if (fileToken.current === fileId) {
      content.current = text;
    }
  };

  const handleParse = async () => {
    const parseId = nextToken();
    dispatch({ type: 'parseStarted', token: parseId });
    await parseNativeImportFile(
      { data: content.current, fileName: state.fileName },
      parseId,
      isNewTarget ? undefined : ontology,
      dispatch,
      describe
    );
  };

  const handleImport = () => {
    const target = nativeImportInstallTarget(
      state,
      isNewTarget ? undefined : ontology,
      currentUserId
    );
    if (target) {
      void install.start(target);
    }
  };

  const readySummary = readySummaryOf(state);
  const errorMessage = nativeImportErrorMessage(state, install.error);
  const isLockedOrBusy = install.isLocked || isBusy;
  const flags = nativeImportActionFlags(state, {
    canUseTarget,
    isBusy,
    isLockedOrBusy,
  });

  return (
    <Box direction="col" gap={4}>
      <Typography color="secondary" size="text-sm">
        {t('message.native-ontology-import-help')}
      </Typography>
      <ProgressSteps
        currentStep={STEP_INDEX[nativeImportStep(state)]}
        size="sm"
        steps={[
          { id: 'drop', title: t('label.choose-file') },
          { id: 'parse', title: t('label.parse') },
          { id: 'import', title: t('label.import') },
        ]}
        type="number"
      />
      <ImportTargetSelect
        canCreate={canCreate}
        isDisabled={isLockedOrBusy}
        isNewTarget={isNewTarget}
        ontology={ontology}
        onChange={(target) =>
          dispatch({ type: 'targetChanged', token: nextToken(), target })
        }
      />
      <ImportFileStep
        isDisabled={isLockedOrBusy || !canUseTarget}
        state={state}
        onFile={(files) => void handleFile(files)}
        onSizeLimitExceed={() =>
          dispatch({
            type: 'detectionFailed',
            fileId: state.fileId,
            message: t('message.file-size-exceeded', { size: '10 MB' }),
          })
        }
      />
      {readySummary && (
        <ImportResult
          hasReviewers={!isNewTarget && hasReviewers(ontology)}
          isNewTarget={isNewTarget}
          summary={readySummary}
        />
      )}
      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}
      <ImportActions
        canImport={flags.canImport}
        canParse={flags.canParse}
        isImporting={install.isBusy}
        isLocked={install.isLocked}
        isParsed={Boolean(readySummary)}
        isParsing={isParsing}
        onImport={handleImport}
        onParse={() => void handleParse()}
      />
    </Box>
  );
};

export default OntologyNativeImportPanel;
