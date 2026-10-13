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
  Box,
  Button,
  Dialog,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { RefreshCcw01 } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { Operation } from 'fast-json-patch';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getPersonaVersions,
  refreshPersonaAIContextDocument,
  updatePersona,
} from '../../../../rest/PersonaAPI';
import {
  buildPersonaContextVersionHistory,
  PersonaContextVersionEntry,
  stripPersonaContextDerivedState,
} from '../../../../utils/PersonaAIContextUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import { VersionHistorySlideout } from '../../../common/VersionHistorySlideout/VersionHistorySlideout.component';

interface VersionHistoryDrawerProps {
  canEdit: boolean;
  open: boolean;
  personaId: string;
  onClose: () => void;
  onRestored?: () => void;
}

export const VersionHistoryDrawer = ({
  canEdit,
  open,
  personaId,
  onClose,
  onRestored,
}: VersionHistoryDrawerProps) => {
  const { t } = useTranslation();
  const isMountedRef = useRef(true);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<PersonaContextVersionEntry[]>([]);
  const [restoringVersion, setRestoringVersion] = useState<string>();
  const [restoreTarget, setRestoreTarget] =
    useState<PersonaContextVersionEntry>();

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchVersions = useCallback(async () => {
    try {
      setLoading(true);
      const history = buildPersonaContextVersionHistory(
        await getPersonaVersions(personaId)
      );
      if (isMountedRef.current) {
        setEntries(history);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [personaId]);

  useEffect(() => {
    if (open) {
      fetchVersions();
    }
  }, [fetchVersions, open]);

  const handleRestore = useCallback(async () => {
    if (!restoreTarget) {
      return;
    }
    const target = restoreTarget;
    setRestoreTarget(undefined);
    try {
      setRestoringVersion(target.version);
      // Replace the whole contextDefinition in a single JSON-Patch op so the
      // patch never depends on a (possibly stale) snapshot base and never
      // carries derived-field churn. `add` on an existing member replaces it.
      const restored = stripPersonaContextDerivedState(
        target.persona.contextDefinition
      );
      const patch: Operation[] = restored
        ? [{ op: 'add', path: '/contextDefinition', value: restored }]
        : [{ op: 'remove', path: '/contextDefinition' }];
      await updatePersona(personaId, patch);
      // The generic PATCH path does not refresh the cache; force a rebuild so
      // the preview/materialized context reflects the restored definition.
      await refreshPersonaAIContextDocument(personaId);
      showSuccessToast(
        t('message.persona-context-version-restored', {
          version: target.version,
        })
      );
      onRestored?.();
      await fetchVersions();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      if (isMountedRef.current) {
        setRestoringVersion(undefined);
      }
    }
  }, [fetchVersions, onRestored, personaId, restoreTarget, t]);

  const historyEntries = useMemo(
    () =>
      entries.map((entry) => ({
        ...entry,
        summary: (
          <Box className="tw:gap-1.5" direction="col">
            {entry.changes.map((change) => (
              <Box
                align="start"
                gap={2}
                key={`${change.key}:${JSON.stringify(change.values)}`}>
                <span className="tw:mt-1.5 tw:size-1.5 tw:shrink-0 tw:rounded-full tw:bg-quaternary" />
                <Typography
                  className="tw:text-[13px]/[1.45] tw:text-secondary"
                  weight="regular">
                  {t(change.key, change.values)}
                </Typography>
              </Box>
            ))}
          </Box>
        ),
      })),
    [entries, t]
  );

  const renderRestoreAction = (entry: PersonaContextVersionEntry) =>
    canEdit && !entry.isCurrent ? (
      <Button
        aria-label={t('label.restore')}
        color="secondary"
        data-testid={`restore-version-${entry.version}`}
        iconLeading={RefreshCcw01}
        isLoading={restoringVersion === entry.version}
        size="sm"
        title={t('label.restore')}
        onClick={() => setRestoreTarget(entry)}
      />
    ) : null;

  return (
    <>
      <VersionHistorySlideout
        emptyMessage={t('message.persona-context-history-empty')}
        entries={historyEntries}
        isLoading={loading}
        isOpen={open}
        renderAction={renderRestoreAction}
        subtitle={t('message.persona-context-history-subtitle')}
        testId="persona-context-version-history"
        onClose={onClose}
      />

      {restoreTarget && (
        <ModalOverlay
          isDismissable
          isOpen
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setRestoreTarget(undefined);
            }
          }}>
          <Modal>
            <Dialog data-testid="restore-version-modal" width={450}>
              <Dialog.Header
                title={t('label.restore-version', {
                  version: restoreTarget.version,
                })}
              />
              <Dialog.Content className="tw:pb-6">
                <Typography className="tw:text-secondary" size="text-sm">
                  {t('message.persona-context-restore-confirmation', {
                    version: restoreTarget.version,
                  })}
                </Typography>
                <Box gap={3} justify="end">
                  <Button
                    color="secondary"
                    onClick={() => setRestoreTarget(undefined)}>
                    {t('label.cancel')}
                  </Button>
                  <Button
                    color="primary"
                    data-testid="confirm-restore-version"
                    iconLeading={RefreshCcw01}
                    onClick={handleRestore}>
                    {t('label.restore')}
                  </Button>
                </Box>
              </Dialog.Content>
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
    </>
  );
};
