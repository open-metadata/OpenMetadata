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
import { isEmpty, isNil } from 'lodash';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ReactComponent as RedAlertIcon } from '../../../assets/svg/ic-alert-red.svg';
import { ReactComponent as ContractIcon } from '../../../assets/svg/ic-contract.svg';
import { ReactComponent as PipelineIcon } from '../../../assets/svg/pipeline-grey.svg';
import { ReactComponent as ShieldIcon } from '../../../assets/svg/policies.svg';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import {
  ContractExecutionStatus,
  DataContract,
} from '../../../generated/entity/data/dataContract';
import { TestSummary } from '../../../generated/tests/testSuite';
import { getContractByEntityId } from '../../../rest/contractAPI';
import { getDataQualityLineage } from '../../../rest/lineageAPI';
import { getTestCaseExecutionSummary } from '../../../rest/testAPI';
import i18n from '../../../utils/i18next/LocalUtil';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import tableClassBase from '../../../utils/TableClassBase';
import {
  AssetHealthState,
  HealthHeader,
  HealthRow,
  HealthTone,
  UseAssetHealthArgs,
} from './AssetHealthWidget.interface';

const CONTRACT_SUPPORTED_TYPES = new Set<EntityType>([
  EntityType.TABLE,
  EntityType.TOPIC,
  EntityType.DASHBOARD,
  EntityType.PIPELINE,
  EntityType.MLMODEL,
  EntityType.CONTAINER,
  EntityType.SEARCH_INDEX,
  EntityType.DASHBOARD_DATA_MODEL,
  EntityType.STORED_PROCEDURE,
  EntityType.API_ENDPOINT,
]);

const DQ_SUPPORTED_TYPES = new Set<EntityType>([
  EntityType.TABLE,
  EntityType.DASHBOARD_DATA_MODEL,
  EntityType.CONTAINER,
]);

const OBSERVABILITY_SUPPORTED_TYPES = new Set<EntityType>([
  EntityType.TABLE,
  EntityType.DASHBOARD_DATA_MODEL,
  EntityType.CONTAINER,
]);

const PIPELINE_ROW_SUPPORTED_TYPES = new Set<EntityType>([EntityType.PIPELINE]);

const contractToneMap: Record<ContractExecutionStatus, HealthTone> = {
  [ContractExecutionStatus.Success]: 'success',
  [ContractExecutionStatus.PartialSuccess]: 'warning',
  [ContractExecutionStatus.Running]: 'info',
  [ContractExecutionStatus.Queued]: 'info',
  [ContractExecutionStatus.Aborted]: 'error',
  [ContractExecutionStatus.Failed]: 'error',
};

const deriveHeader = (rows: HealthRow[]): HealthHeader => {
  if (rows.every((r) => r.tone === 'muted')) {
    return { label: i18n.t('label.not-set-up'), tone: 'muted' };
  }
  const errorRows = rows.filter((r) => r.tone === 'error').length;
  if (errorRows >= 2) {
    return { label: i18n.t('label.critical'), tone: 'error' };
  }
  if (errorRows > 0) {
    return { label: i18n.t('label.attention'), tone: 'error' };
  }
  if (rows.some((r) => r.tone === 'warning')) {
    return { label: i18n.t('label.attention'), tone: 'warning' };
  }

  return { label: i18n.t('label.all-clear'), tone: 'success' };
};

const buildContractRow = (
  contract: DataContract | undefined,
  entityType: EntityType,
  entityFqn?: string
): HealthRow | null => {
  if (!CONTRACT_SUPPORTED_TYPES.has(entityType)) {
    return null;
  }
  const icon: ReactNode = <ContractIcon height={14} width={14} />;
  const jumpTooltip = i18n.t('label.jump-to-tab', {
    tab: i18n.t('label.contract'),
  });
  if (!contract || !contract.latestResult?.status) {
    return {
      key: 'contract',
      iconTone: 'error',
      icon,
      label: i18n.t('label.contract'),
      status: i18n.t('label.no-contract'),
      tone: 'muted',
      cta: i18n.t('label.add-entity', {
        entity: i18n.t('label.contract'),
      }),
      href: entityFqn
        ? getEntityDetailsPath(entityType, entityFqn, EntityTabs.CONTRACT)
        : undefined,
      tooltip: jumpTooltip,
    };
  }
  const status = contract.latestResult.status;
  const sub = contract.latestResult.message;

  return {
    key: 'contract',
    iconTone: 'error',
    icon,
    label: i18n.t('label.contract'),
    status: status,
    sub,
    tone: contractToneMap[status] ?? 'info',
    href: entityFqn
      ? getEntityDetailsPath(entityType, entityFqn, EntityTabs.CONTRACT)
      : undefined,
    tooltip: jumpTooltip,
  };
};

const buildDqRow = (
  summary: TestSummary | undefined,
  entityType: EntityType,
  entityFqn?: string
): HealthRow | null => {
  if (!DQ_SUPPORTED_TYPES.has(entityType)) {
    return null;
  }
  const icon: ReactNode = <ShieldIcon height={14} width={14} />;
  const href = entityFqn
    ? getEntityDetailsPath(entityType, entityFqn, EntityTabs.PROFILER)
    : undefined;
  const jumpTooltip = i18n.t('label.jump-to-tab', {
    tab: i18n.t('label.data-observability'),
  });
  if (!summary || !summary.total) {
    return {
      key: 'dataQuality',
      iconTone: 'error',
      icon,
      label: i18n.t('label.data-quality'),
      status: i18n.t('label.no-tests'),
      tone: 'muted',
      cta: i18n.t('label.add-tests'),
      href,
      tooltip: jumpTooltip,
    };
  }
  const failed = summary.failed ?? 0;
  const success = summary.success ?? 0;
  const total = summary.total;
  if (failed > 0) {
    return {
      key: 'dataQuality',
      iconTone: 'error',
      icon,
      label: i18n.t('label.data-quality'),
      status: `${failed} failed`,
      sub: `${success} of ${total} tests`,
      tone: 'error',
      href,
      tooltip: jumpTooltip,
    };
  }

  return {
    key: 'dataQuality',
    iconTone: 'error',
    icon,
    label: i18n.t('label.data-quality'),
    status: i18n.t('label.passing'),
    sub: `${total} of ${total} tests`,
    tone: 'success',
    href,
    tooltip: jumpTooltip,
  };
};

const buildObservabilityRow = (
  anomalyCount: number | undefined,
  entityType: EntityType,
  entityFqn?: string
): HealthRow | null => {
  if (!OBSERVABILITY_SUPPORTED_TYPES.has(entityType)) {
    return null;
  }
  const icon: ReactNode = <RedAlertIcon height={14} width={14} />;
  const href = entityFqn
    ? getEntityDetailsPath(entityType, entityFqn, EntityTabs.PROFILER)
    : undefined;
  const jumpTooltip = i18n.t('label.jump-to-tab', {
    tab: i18n.t('label.data-observability'),
  });
  if (isNil(anomalyCount)) {
    return {
      key: 'dataObservability',
      iconTone: 'warning',
      icon,
      label: i18n.t('label.data-observability'),
      status: i18n.t('label.not-set-up'),
      tone: 'muted',
      cta: i18n.t('label.enable'),
      href,
      tooltip: jumpTooltip,
    };
  }
  if (anomalyCount === 0) {
    return {
      key: 'dataObservability',
      iconTone: 'warning',
      icon,
      label: i18n.t('label.data-observability'),
      status: i18n.t('label.no-anomaly-plural'),
      tone: 'success',
      href,
      tooltip: jumpTooltip,
    };
  }

  return {
    key: 'dataObservability',
    iconTone: 'warning',
    icon,
    label: i18n.t('label.data-observability'),
    status: `${anomalyCount} anomal${anomalyCount === 1 ? 'y' : 'ies'}`,
    tone: 'warning',
    href,
    tooltip: jumpTooltip,
  };
};

const buildPipelineRow = (
  pipelineLatestStatus: string | undefined,
  entityType: EntityType,
  entityFqn?: string
): HealthRow | null => {
  if (!PIPELINE_ROW_SUPPORTED_TYPES.has(entityType)) {
    return null;
  }
  const icon: ReactNode = <PipelineIcon height={14} width={14} />;
  const href = entityFqn
    ? getEntityDetailsPath(entityType, entityFqn)
    : undefined;
  const jumpTooltip = i18n.t('label.open-entity', {
    entity: i18n.t('label.pipeline'),
  });
  if (!pipelineLatestStatus) {
    return {
      key: 'pipeline',
      iconTone: 'success',
      icon,
      label: i18n.t('label.pipeline'),
      status: i18n.t('label.not-set-up'),
      tone: 'muted',
      cta: i18n.t('label.link-pipeline'),
      href,
      tooltip: jumpTooltip,
    };
  }
  const tone: HealthTone =
    pipelineLatestStatus === 'Failed'
      ? 'error'
      : pipelineLatestStatus === 'Pending'
      ? 'info'
      : pipelineLatestStatus === 'Successful'
      ? 'success'
      : 'muted';

  return {
    key: 'pipeline',
    iconTone: 'success',
    icon,
    label: i18n.t('label.pipeline'),
    status: pipelineLatestStatus,
    tone,
    href,
    tooltip: jumpTooltip,
  };
};

export const useAssetHealth = ({
  entityId,
  entityFqn,
  entityType,
  testSuiteId,
  pipelineLatestStatus,
  enabled = true,
}: UseAssetHealthArgs): AssetHealthState => {
  const [contract, setContract] = useState<DataContract | undefined>();
  const [dqSummary, setDqSummary] = useState<TestSummary | undefined>();
  const [anomalyCount, setAnomalyCount] = useState<number | undefined>();
  const [loadingFlags, setLoadingFlags] = useState({
    contract: false,
    dq: false,
    obs: false,
  });

  useEffect(() => {
    if (!enabled || !entityId || !CONTRACT_SUPPORTED_TYPES.has(entityType)) {
      return;
    }
    setLoadingFlags((f) => ({ ...f, contract: true }));
    getContractByEntityId(entityId, entityType)
      .then(setContract)
      .catch(() => setContract(undefined))
      .finally(() => setLoadingFlags((f) => ({ ...f, contract: false })));
  }, [enabled, entityId, entityType]);

  useEffect(() => {
    if (!enabled || !testSuiteId || !DQ_SUPPORTED_TYPES.has(entityType)) {
      return;
    }
    setLoadingFlags((f) => ({ ...f, dq: true }));
    getTestCaseExecutionSummary(testSuiteId)
      .then(setDqSummary)
      .catch(() => setDqSummary(undefined))
      .finally(() => setLoadingFlags((f) => ({ ...f, dq: false })));
  }, [enabled, testSuiteId, entityType]);

  useEffect(() => {
    if (
      !enabled ||
      !entityFqn ||
      !OBSERVABILITY_SUPPORTED_TYPES.has(entityType) ||
      !tableClassBase.getAlertEnableStatus()
    ) {
      return;
    }
    setLoadingFlags((f) => ({ ...f, obs: true }));
    getDataQualityLineage(entityFqn, { upstreamDepth: 1 })
      .then((data) => {
        const upstream = (data.nodes ?? []).filter(
          (n) => n?.fullyQualifiedName !== entityFqn
        );
        setAnomalyCount(upstream.length);
      })
      .catch(() => setAnomalyCount(undefined))
      .finally(() => setLoadingFlags((f) => ({ ...f, obs: false })));
  }, [enabled, entityFqn, entityType]);

  return useMemo<AssetHealthState>(() => {
    const candidates: Array<HealthRow | null> = [
      buildPipelineRow(pipelineLatestStatus, entityType, entityFqn),
      buildDqRow(dqSummary, entityType, entityFqn),
      buildObservabilityRow(anomalyCount, entityType, entityFqn),
      buildContractRow(contract, entityType, entityFqn),
    ];
    const rows = candidates.filter((r): r is HealthRow => r !== null);
    const header: HealthHeader = isEmpty(rows)
      ? { label: i18n.t('label.not-set-up'), tone: 'muted' }
      : deriveHeader(rows);

    return {
      rows,
      header,
      loading: loadingFlags.contract || loadingFlags.dq || loadingFlags.obs,
      contractTone: rows.find((r) => r.key === 'contract')?.tone,
      observabilityTone: rows.find((r) => r.key === 'dataObservability')?.tone,
    };
  }, [
    contract,
    dqSummary,
    anomalyCount,
    pipelineLatestStatus,
    entityType,
    entityFqn,
    loadingFlags,
  ]);
};
