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
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowUpRight,
  CheckCircle,
} from '@openmetadata/ui-core-components/icons';
import { isAxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { CreateOntology } from '../../../../generated/api/data/createOntology';
import type { OntologyPackManifest } from '../../../../generated/api/data/ontologyPackManifest';
import type { Ontology } from '../../../../generated/entity/data/ontology';
import type { OntologyPackInstallationRecord } from '../../../../generated/type/ontologyPackInstallationRecord';
import { useOntologyChangeSetApply } from '../../../../hooks/governance/ontology/useOntologyChangeSetApply';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import {
  getOntology,
  previewNativeOntologyPack,
} from '../../../../rest/ontologyAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import {
  defaultModuleIds,
  selectedModuleTotals,
  updateModuleSelection,
} from '../../../OntologyExplorer/OntologyLibrary.utils';
import OntologyLibraryDetail from '../../../OntologyExplorer/OntologyLibraryDetail';
import {
  nativeLibraryOntologyRequest,
  resolveNativeLibraryTarget,
} from './OntologyNativeLibraryDetail.utils';

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
  const currentUserId = useApplicationStore((state) => state.currentUser?.id);
  const [targetId, setTargetId] = useState('new');
  const [target, setTarget] = useState<Ontology>();
  const [selectedModuleIds, setSelectedModuleIds] = useState(() =>
    defaultModuleIds(pack)
  );
  const [phase, setPhase] = useState<
    'idle' | 'creating' | 'permission' | 'previewing' | 'blocked'
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
  const apply = useOntologyChangeSetApply({
    canApply: canEditTarget,
    onApplied: () => finish('applied'),
  });
  const isBusy =
    ['creating', 'permission', 'previewing'].includes(phase) ||
    apply.status.kind === 'busy';
  const isLocked =
    Boolean(attempt.current) || apply.configurationLocked || isBusy;
  const totals = selectedModuleTotals(pack, selectedModuleIds);

  useEffect(() => {
    onBusyChange(isBusy);
  }, [isBusy, onBusyChange]);

  useEffect(() => {
    if (apply.status.kind === 'unchanged' && attempt.current) {
      finish('unchanged');
    }
  }, [apply.status.kind, finish]);

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
    setPhase('previewing');
    void previewNativeOntologyPack(current.target.id, pack.id, {
      moduleIds: current.moduleIds,
    })
      .then(async (plan) => {
        setPhase('idle');
        preparing.current = false;
        await apply.start(plan);
      })
      .catch((cause: unknown) => {
        preparing.current = false;
        setPhase('blocked');
        setError(t('server.unexpected-error'));
        showErrorToast(
          isAxiosError(cause) ? cause : t('server.unexpected-error')
        );
      });
  }, [canEditTarget, isPermissionLoading, pack.id, phase, t, apply]);

  const isInstallDisabled = () => {
    if (isBusy || !selectedModuleIds.length) {
      return true;
    }
    if (targetId === 'new' && !target) {
      return !canCreate || !currentUserId;
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

  const install = async () => {
    if (preparing.current || isBusy) {
      return;
    }
    setError(undefined);
    if (apply.configurationLocked) {
      await apply.retry();

      return;
    }
    if (!attempt.current) {
      if (isInstallDisabled()) {
        return;
      }
      attempt.current = {
        moduleIds: [...selectedModuleIds],
        target,
        request:
          targetId === 'new' && currentUserId
            ? nativeLibraryOntologyRequest(pack, currentUserId)
            : undefined,
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
          isDisabled={isInstallDisabled()}
          isLoading={isBusy || Boolean(target && isPermissionLoading)}
          onPress={() => void install()}>
          {isLocked && !isBusy ? t('label.retry') : t('label.install-ontology')}
        </Button>
        <Typography color="secondary" size="text-xs">
          {t('message.ontology-library-customize-help')}
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
                  variant="muted">
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
            {renderInstallActions()}
            {error && <Alert variant="error">{error}</Alert>}
            {apply.status.kind === 'blocked' && (
              <Alert variant="error">{apply.status.message}</Alert>
            )}
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
