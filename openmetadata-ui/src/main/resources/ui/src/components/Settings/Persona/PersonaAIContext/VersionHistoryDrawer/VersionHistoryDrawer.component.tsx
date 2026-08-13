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
  Avatar,
  Badge,
  Box,
  Button,
  Dialog,
  Modal,
  ModalOverlay,
  SlideoutMenu,
  Typography,
} from '@openmetadata/ui-core-components';
import { RefreshCcw01 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { Operation } from 'fast-json-patch';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getPersonaVersions,
  refreshPersonaAIContextDocument,
  updatePersona,
} from '../../../../../rest/PersonaAPI';
import {
  DATE_TIME_12_HOUR_FORMAT,
  formatDateTimeLong,
  getRelativeTime,
} from '../../../../../utils/date-time/DateTimeUtils';
import {
  buildPersonaContextVersionHistory,
  PersonaContextVersionEntry,
  stripPersonaContextDerivedState,
} from '../../../../../utils/PersonaAIContextUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../utils/ToastUtils';
import Loader from '../../../../common/Loader/Loader';

interface VersionHistoryDrawerProps {
  canEdit: boolean;
  open: boolean;
  personaId: string;
  onClose: () => void;
  onRestored?: () => void;
}

const RELATIVE_TIME_THRESHOLD = 24 * 60 * 60 * 1000;

const formatUpdatedAt = (updatedAt?: number): string => {
  if (!updatedAt) {
    return '';
  }

  return Date.now() - updatedAt < RELATIVE_TIME_THRESHOLD
    ? getRelativeTime(updatedAt)
    : formatDateTimeLong(updatedAt, DATE_TIME_12_HOUR_FORMAT);
};

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

  const renderTimeline = () => (
    <Box direction="col">
      {entries.map((entry, index) => {
        const isLast = index === entries.length - 1;
        const initials = (entry.updatedBy ?? '?').charAt(0).toUpperCase();

        return (
          <Box gap={4} key={entry.version}>
            <Box align="center" className="tw:shrink-0" direction="col">
              <span
                className={`tw:mt-1.5 tw:size-3.5 tw:shrink-0 tw:rounded-full tw:border-2 ${
                  entry.isCurrent
                    ? 'tw:border-brand tw:bg-brand-solid'
                    : 'tw:border-primary tw:bg-primary'
                }`}
                data-testid={`version-dot-${entry.version}`}
              />
              {!isLast && (
                <span className="tw:my-1 tw:w-0 tw:flex-1 tw:border-l tw:border-secondary" />
              )}
            </Box>

            <Box className="tw:min-w-0 tw:flex-1 tw:pb-5.5" direction="col">
              <Box
                align="center"
                className="tw:mb-1.5"
                gap={2}
                justify="between">
                <Box align="center" gap={2}>
                  <Typography
                    className="tw:text-primary"
                    size="text-sm"
                    weight="semibold">
                    {t('label.version-short', { version: entry.version })}
                  </Typography>
                  {entry.isCurrent && (
                    <Badge color="brand" size="sm">
                      {t('label.current')}
                    </Badge>
                  )}
                </Box>
                {canEdit && !entry.isCurrent && (
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
                )}
              </Box>

              <Box className="tw:gap-1.5" direction="col">
                {entry.changes.map((change, changeIndex) => (
                  <Box
                    align="start"
                    gap={2}
                    key={`${change.key}-${changeIndex}`}>
                    <span className="tw:mt-1.5 tw:size-1.5 tw:shrink-0 tw:rounded-full tw:bg-quaternary" />
                    <Typography
                      className="tw:text-[13px]/[1.45] tw:text-secondary"
                      weight="regular">
                      {t(change.key, change.values)}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {entry.updatedBy && (
                <Box align="center" className="tw:mt-2" gap={2}>
                  <Avatar initials={initials} size="xs" />
                  <Typography
                    className="tw:text-brand-secondary"
                    size="text-xs"
                    weight="medium">
                    {entry.updatedBy}
                  </Typography>
                  <Typography className="tw:text-quaternary" size="text-xs">
                    ·
                  </Typography>
                  <Typography className="tw:text-quaternary" size="text-xs">
                    {formatUpdatedAt(entry.updatedAt)}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );

  const renderBody = () => {
    if (loading && entries.length === 0) {
      return (
        <Box align="center" className="tw:min-h-40 tw:flex-1" justify="center">
          <Loader />
        </Box>
      );
    }

    if (entries.length === 0) {
      return (
        <Box
          align="center"
          className="tw:min-h-40 tw:flex-1 tw:p-10"
          justify="center">
          <Typography className="tw:text-tertiary" size="text-sm">
            {t('message.persona-context-history-empty')}
          </Typography>
        </Box>
      );
    }

    return renderTimeline();
  };

  return (
    <>
      <SlideoutMenu
        isOpen={open}
        width={520}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            onClose();
          }
        }}>
        <SlideoutMenu.Header
          className="tw:border-b tw:border-secondary tw:px-6! tw:py-5!"
          onClose={onClose}>
          <Box direction="col" gap={1}>
            <Typography
              className="tw:text-primary"
              size="text-lg"
              weight="semibold">
              {t('label.version-history')}
            </Typography>
            <Typography className="tw:text-secondary" size="text-sm">
              {t('message.persona-context-history-subtitle')}
            </Typography>
          </Box>
        </SlideoutMenu.Header>
        <SlideoutMenu.Content
          className="tw:flex tw:flex-col tw:overflow-auto"
          data-testid="persona-context-version-history">
          {renderBody()}
        </SlideoutMenu.Content>
      </SlideoutMenu>

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
