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
  Card,
  Divider,
  ProgressBar,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle,
} from '@openmetadata/ui-core-components/icons';
import { isAxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { CreateOntology } from '../../../../generated/api/data/createOntology';
import {
  OntologyPackInstallJob,
  Status as InstallJobStatus,
} from '../../../../generated/api/data/ontologyPackInstallJob';
import type { OntologyPackManifest } from '../../../../generated/api/data/ontologyPackManifest';
import type { Ontology } from '../../../../generated/entity/data/ontology';
import type { OntologyPackInstallationRecord } from '../../../../generated/type/ontologyPackInstallationRecord';
import { useOntologyPackInstallJob } from '../../../../hooks/governance/ontology/useOntologyPackInstallJob';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import { getOntology } from '../../../../rest/ontologyAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import {
  defaultModuleIds,
  selectedModuleTotals,
  updateModuleSelection,
} from '../../../OntologyExplorer/OntologyLibrary.utils';
import OntologyLibraryDetail from '../../../OntologyExplorer/OntologyLibraryDetail';
import { useOntologyIdentitySource } from '../OntologyCreateForm/useOntologyIdentitySource';
import {
  nativeLibraryOntologyRequest,
  resolveNativeLibraryTarget,
} from './OntologyNativeLibraryDetail.utils';
import OntologyNativePackReview, {
  useNativePackReview,
} from './OntologyNativePackReview';

export interface NativeLibraryCompletion {
  ontology: Ontology;
  moduleIds: string[];
  outcome: 'applied' | 'unchanged';
}

export interface OntologyNativeLibraryDetailProps {
  pack: OntologyPackManifest;
  ontologies: Ontology[];
  initialOntology?: Ontology;
  canCreate: boolean;
  installedIn: OntologyPackInstallationRecord[];
  onCreated: (ontology: Ontology) => void;
  onApplied: (ontology: Ontology) => void;
  onCompleted: (completion: NativeLibraryCompletion) => void;
  onOpenOntology: (ontology: Ontology) => void;
  onBusyChange: (busy: boolean) => void;
  onBack: () => void;
}

const OntologyNativeLibraryDetail = ({
  pack,
  ontologies,
  initialOntology,
  canCreate,
  installedIn,
  onCreated,
  onApplied,
  onCompleted,
  onOpenOntology,
  onBusyChange,
  onBack,
}: OntologyNativeLibraryDetailProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const currentUserId = useApplicationStore((state) => state.currentUser?.id);
  const { refreshIdentityOf, isReady: isIdentityReady } =
    useOntologyIdentitySource(canCreate);
  const [targetId, setTargetId] = useState('new');
  const [target, setTarget] = useState<Ontology>();
  const [selectedModuleIds, setSelectedModuleIds] = useState(() =>
    defaultModuleIds(pack)
  );
  const [phase, setPhase] = useState<
    'idle' | 'creating' | 'permission' | 'installing' | 'blocked'
  >('idle');
  const [error, setError] = useState<string>();
  const attempt = useRef<{
    request?: CreateOntology;
    target?: Ontology;
    moduleIds: string[];
  }>();
  const preparing = useRef(false);
  const availableOntologies = useMemo(() => {
    const byId = new Map(ontologies.map((ontology) => [ontology.id, ontology]));
    [initialOntology, target].forEach((ontology) => {
      if (ontology) {
        byId.set(ontology.id, ontology);
      }
    });

    return [...byId.values()].filter((ontology) => !ontology.deleted);
  }, [initialOntology, ontologies, target]);
  const {
    canEditAll,
    isLoading: isPermissionLoading,
    error: permissionError,
  } = useEntityPermissions(
    ResourceEntity.ONTOLOGY,
    { id: target?.id ?? '' },
    { enabled: Boolean(target), deleted: target?.deleted }
  );
  const canEditTarget = Boolean(
    target && canEditAll && !isPermissionLoading && !permissionError
  );
  const finish = useCallback(
    (outcome: NativeLibraryCompletion['outcome']) => {
      const current = attempt.current;
      if (!current?.target) {
        return;
      }
      const installed = {
        ontology: current.target,
        moduleIds: current.moduleIds,
        outcome,
      };
      setPhase('idle');
      preparing.current = false;
      attempt.current = undefined;
      onCompleted(installed);
      if (outcome === 'applied') {
        onApplied(installed.ontology);
      }
    },
    [onApplied, onCompleted]
  );
  const installJob = useOntologyPackInstallJob();
  const startInstallJob = installJob.run;
  const settle = useCallback(
    (settled: OntologyPackInstallJob) => {
      if (settled.status === InstallJobStatus.Completed) {
        finish(settled.total === 0 ? 'unchanged' : 'applied');

        return;
      }
      setPhase('blocked');
      setError(
        settled.status === InstallJobStatus.Cancelled
          ? t('message.ontology-library-install-cancelled')
          : settled.error ?? t('server.unexpected-error')
      );
    },
    [finish, t]
  );
  const isBusy = ['creating', 'permission', 'installing'].includes(phase);
  const isLocked = Boolean(attempt.current) || isBusy;
  const totals = selectedModuleTotals(pack, selectedModuleIds);

  useEffect(() => {
    onBusyChange(isBusy);
  }, [isBusy, onBusyChange]);

  useEffect(() => {
    if (phase !== 'permission' || isPermissionLoading || !preparing.current) {
      return;
    }
    const current = attempt.current;
    if (!current?.target) {
      return;
    }
    if (!canEditTarget) {
      preparing.current = false;
      setPhase('blocked');
      setError(t('message.no-permission-for-action'));

      return;
    }
    preparing.current = false;
    setPhase('installing');
    void startInstallJob(current.target.id, pack.id, current.moduleIds)
      .then((settled) => settled && settle(settled))
      .catch((cause: unknown) => {
        setPhase('blocked');
        setError(t('server.unexpected-error'));
        showErrorToast(
          isAxiosError(cause) ? cause : t('server.unexpected-error')
        );
      });
  }, [
    canEditTarget,
    isPermissionLoading,
    pack.id,
    phase,
    t,
    startInstallJob,
    settle,
  ]);

  const review = useNativePackReview(
    targetId === 'new' ? undefined : targetId,
    pack.id,
    selectedModuleIds
  );
  const isInstallDisabled = () => {
    if (isBusy || !selectedModuleIds.length) {
      return true;
    }
    if (targetId !== 'new' && !review.isSuccess) {
      return true;
    }
    if (targetId === 'new' && !target) {
      return !canCreate || !currentUserId || !isIdentityReady;
    }

    return !canEditTarget;
  };

  const resolveTarget = async (
    current: NonNullable<typeof attempt.current>
  ) => {
    if (current.target) {
      return;
    }
    if (!current.request || !canCreate || !currentUserId) {
      throw new Error('Ontology creation is not permitted.');
    }
    setPhase('creating');
    current.target = await resolveNativeLibraryTarget(
      current.request,
      phase === 'blocked'
    );
    setTarget(current.target);
    setTargetId(current.target.id);
    onCreated(current.target);
  };

  const newOntologyRequest = async () => {
    if (targetId !== 'new' || !currentUserId) {
      return undefined;
    }
    const nameOf = await refreshIdentityOf();

    return nativeLibraryOntologyRequest(pack, currentUserId, nameOf(pack.name));
  };

  const install = async () => {
    if (preparing.current || isBusy) {
      return;
    }
    setError(undefined);
    if (!attempt.current) {
      if (isInstallDisabled()) {
        return;
      }
      const request = await newOntologyRequest();
      if (attempt.current) {
        return;
      }
      attempt.current = {
        moduleIds: [...selectedModuleIds],
        target,
        request,
      };
    }
    const current = attempt.current;
    preparing.current = true;
    try {
      await resolveTarget(current);
      setPhase('permission');
    } catch (cause) {
      preparing.current = false;
      setPhase('blocked');
      setError(t('server.unexpected-error'));
      showErrorToast(
        isAxiosError(cause) ? cause : t('server.unexpected-error')
      );
    }
  };

  const resetCompletion = () => {
    setError(undefined);
  };
  const isTargetDenied = () =>
    target ? !canEditTarget && !isPermissionLoading : !canCreate;

  const renderInstallProgress = () => {
    const { job } = installJob;
    if (!job || job.total === 0) {
      return (
        <Typography color="secondary" size="text-xs">
          {t('message.ontology-library-install-preparing')}
        </Typography>
      );
    }

    return (
      <Box
        data-testid="ontology-library-install-progress"
        direction="col"
        gap={2}>
        <ProgressBar max={job.total} value={job.progress} />
        <Box align="center" gap={3} justify="between">
          <Typography color="secondary" size="text-xs">
            {t('message.ontology-library-install-progress', {
              done: job.progress,
              total: job.total,
              applied: job.membersApplied,
              members: job.memberCount,
            })}
          </Typography>
          <Button
            color="secondary"
            data-testid="ontology-library-install-cancel"
            isDisabled={Boolean(job.cancelRequested)}
            size="sm"
            onPress={() => void installJob.cancel().catch(showErrorToast)}>
            {t('label.cancel')}
          </Button>
        </Box>
      </Box>
    );
  };

  const renderInstallActions = () => {
    return (
      <>
        {isTargetDenied() && (
          <Alert variant="warning">
            {t('message.no-permission-for-action')}
          </Alert>
        )}
        <Button
          color="primary"
          data-testid="ontology-library-native-install"
          iconTrailing={isLocked && !isBusy ? undefined : ArrowRight}
          isDisabled={isInstallDisabled()}
          isLoading={isBusy || Boolean(target && isPermissionLoading)}
          onPress={() => void install()}>
          {isLocked && !isBusy ? t('label.retry') : t('label.install-ontology')}
        </Button>
        <Typography
          color="secondary"
          data-testid="ontology-library-module-hint"
          size="text-xs">
          {selectedModuleIds.length
            ? t('message.ontology-library-customize-help')
            : t('message.ontology-library-select-module')}
        </Typography>
      </>
    );
  };

  const renderInstallPanel = () => {
    if (!pack.bundled) {
      return (
        <Alert
          rightContent={
            <Button
              color="secondary"
              href={pack.sourceUrl}
              iconTrailing={ArrowUpRight}
              rel="noreferrer"
              size="sm"
              target="_blank">
              {t('label.source')}
            </Button>
          }
          title={t('message.ontology-pack-external-title')}
          variant="warning">
          {t('message.ontology-pack-external-description')}
        </Alert>
      );
    }

    return (
      <Card size="md">
        <Card.Content>
          <Box direction="col" gap={4}>
            <Select
              data-testid="ontology-library-target"
              isDisabled={isLocked}
              label={t('label.install-to')}
              selectedKey={targetId}
              onSelectionChange={(id) => {
                if (isLocked || id == null) {
                  return;
                }
                setTargetId(String(id));
                setTarget(
                  availableOntologies.find((ontology) => ontology.id === id)
                );
                resetCompletion();
              }}>
              <Select.Item
                id="new"
                isDisabled={!canCreate || !currentUserId}
                label={t('label.new-ontology-for-pack', { name: pack.name })}
              />
              {availableOntologies.map((ontology) => (
                <Select.Item
                  id={ontology.id}
                  key={ontology.id}
                  label={ontology.displayName ?? ontology.name}
                />
              ))}
            </Select>
            <Box gap={3}>
              {[
                {
                  count: totals.concepts,
                  label: 'label.concept-plural',
                  id: 'concept',
                },
                {
                  count: totals.relationships,
                  label: 'label.relation-plural',
                  id: 'relationship',
                },
              ].map((item) => (
                <Card
                  className="tw:flex-1"
                  key={item.id}
                  size="sm"
                  variant={isAiMode ? 'default' : 'muted'}>
                  <Card.Content>
                    <Typography
                      as="div"
                      data-testid={`ontology-pack-${item.id}-count`}
                      size="text-xl"
                      weight="semibold">
                      {item.count}
                    </Typography>
                    <Typography color="secondary" size="text-xs">
                      {t(item.label)}
                    </Typography>
                  </Card.Content>
                </Card>
              ))}
            </Box>
            {targetId !== 'new' && <OntologyNativePackReview review={review} />}
            {renderInstallActions()}
            {phase === 'installing' && renderInstallProgress()}
            {error && <Alert variant="error">{error}</Alert>}
            <Divider />
            <Box align="center" gap={2}>
              <CheckCircle className="tw:size-4 tw:text-fg-success-primary" />
              <Typography color="secondary" size="text-xs">
                {pack.standard}
              </Typography>
            </Box>
          </Box>
        </Card.Content>
      </Card>
    );
  };

  return (
    <OntologyLibraryDetail
      native={{
        installPanel: renderInstallPanel(),
        canSelectModules: !isLocked,
        isBusy,
        installedIn:
          installedIn.length > 0 ? (
            <Box align="center" gap={2} wrap="wrap">
              <Typography color="secondary" size="text-sm">
                {t('label.ontology-library-installed-in')}
              </Typography>
              {installedIn.map((record) => (
                <Button
                  color="link-color"
                  data-testid={`ontology-library-installed-in-${record.ontology.id}`}
                  key={record.ontology.id}
                  size="sm"
                  onPress={() => {
                    void getOntology(record.ontology.id)
                      .then(onOpenOntology)
                      .catch(showErrorToast);
                  }}>
                  {record.ontology.displayName ?? record.ontology.name}
                </Button>
              ))}
            </Box>
          ) : undefined,
      }}
      pack={pack}
      selectedModuleIds={selectedModuleIds}
      onBack={onBack}
      onModuleChange={(id, selected) => {
        if (!isLocked) {
          setSelectedModuleIds((current) =>
            updateModuleSelection(pack, current, id, selected)
          );
          resetCompletion();
        }
      }}
    />
  );
};

export default OntologyNativeLibraryDetail;
