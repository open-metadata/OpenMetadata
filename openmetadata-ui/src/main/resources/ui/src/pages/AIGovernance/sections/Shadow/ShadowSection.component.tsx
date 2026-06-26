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

import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  PLACEHOLDER_ROUTE_ENTITY_TYPE,
  PLACEHOLDER_ROUTE_FQN,
  ROUTES,
} from '../../../../constants/constants';
import { getAIApplications } from '../../../../rest/aiApplicationAPI';
import {
  AIGovernanceEntityType,
  shadowBulkTriage,
} from '../../../../rest/aiGovernanceAPI';
import { getLLMModels } from '../../../../rest/llmModelAPI';
import { getMcpServers } from '../../../../rest/mcpServerAPI';
import { getEncodedFqn } from '../../../../utils/StringsUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import {
  Button,
  Modal,
  Spin,
  Typography,
} from '../../components/AIGovUntitled.component';
import { IcAlertTri, IcCheck, IcEye } from '../../icons/AIGovIcons';
import { formatAge } from '../aiGovSection.utils';
import './shadow-section.less';

interface ShadowRow {
  id: string;
  name: string;
  displayName?: string;
  fqn: string;
  entityType: AIGovernanceEntityType;
  source?: string;
  sourceDetails?: string;
  volume7d?: string;
  suspectedUser?: string;
  suspectedTeam?: string;
  severity?: string;
  flags: string[];
  detectedAt?: number;
}

interface DetectionDetails {
  source?: string;
  sourceDetails?: string;
  volume7d?: string;
  suspectedUser?: string;
  suspectedTeam?: string;
  severity?: string;
  flags?: string[];
  detectedAt?: number;
}

const SEVERITY_PILL: Record<string, string> = {
  High: 'ai-gov-pill--high',
  Medium: 'ai-gov-pill--medium',
  Low: 'ai-gov-pill--low',
};

const getDetection = (value: unknown): DetectionDetails | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  return (value as { detection?: DetectionDetails }).detection;
};

const ShadowSection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ShadowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkAction, setBulkAction] = useState<'Register' | 'Dismiss' | null>(
    null
  );
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [apps, llms, mcps] = await Promise.allSettled([
          getAIApplications('owners,governanceMetadata', { limit: 200 }),
          getLLMModels(undefined, 'owners,governanceStatus,detection', {
            limit: 200,
          }),
          getMcpServers(undefined, 'owners,governanceMetadata', { limit: 200 }),
        ]);
        const merged: ShadowRow[] = [];
        if (apps.status === 'fulfilled') {
          apps.value.data
            .filter(
              (a) => a.governanceMetadata?.registrationStatus === 'Unregistered'
            )
            .forEach((a) =>
              merged.push(
                toShadowRow(
                  a,
                  'aiApplication',
                  getDetection(a.governanceMetadata)
                )
              )
            );
        }
        if (llms.status === 'fulfilled') {
          llms.value.data
            .filter((m) => m.governanceStatus === 'Unauthorized')
            .forEach((m) =>
              merged.push(toShadowRow(m, 'llmModel', getDetection(m)))
            );
        }
        if (mcps.status === 'fulfilled') {
          mcps.value.data
            .filter(
              (s) => s.governanceMetadata?.registrationStatus === 'Unregistered'
            )
            .forEach((s) =>
              merged.push(
                toShadowRow(s, 'mcpServer', getDetection(s.governanceMetadata))
              )
            );
        }
        setRows(merged);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [refreshKey]);

  const piiCount = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.flags.some(
            (flag) =>
              flag.toLowerCase().includes('pii') &&
              !flag.toLowerCase().includes('dpa')
          ) ||
          row.flags.some((flag) => flag.toLowerCase() === 'pii without dpa')
      ).length,
    [rows]
  );

  const handleBulk = async (action: 'Register' | 'Dismiss') => {
    const items = rows.map((row) => ({
      entityType: row.entityType,
      id: row.id,
    }));
    if (items.length === 0) {
      return;
    }
    try {
      await shadowBulkTriage({ action, items });
      showSuccessToast(
        t('message.bulk-triage-success', { count: items.length, action })
      );
      setBulkAction(null);
      setRefreshKey((k) => k + 1);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleRowAction = async (
    row: ShadowRow,
    action: 'Register' | 'Dismiss'
  ) => {
    try {
      await shadowBulkTriage({
        action,
        items: [{ entityType: row.entityType, id: row.id }],
      });
      showSuccessToast(t('message.bulk-triage-success', { count: 1, action }));
      setRefreshKey((k) => k + 1);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleOpenAsset = (row: ShadowRow) => {
    navigate(
      ROUTES.AI_GOVERNANCE_ASSET_DETAILS.replace(
        PLACEHOLDER_ROUTE_ENTITY_TYPE,
        row.entityType
      ).replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(row.fqn))
    );
  };

  return (
    <div className="ai-gov-shadow">
      <div className="ai-gov-shadow-banner">
        <div className="ai-gov-shadow-banner-icon">
          <IcEye />
        </div>
        <div style={{ flex: 1 }}>
          <div className="ai-gov-shadow-banner-title">
            {t('message.shadow-ai-control-plane-title', { count: rows.length })}
          </div>
          <div className="ai-gov-shadow-banner-sub">
            {t('message.shadow-ai-control-plane-detail', { pii: piiCount })}
          </div>
        </div>
        <Button
          className="ai-gov-shadow-banner-btn"
          disabled={rows.length === 0}
          type="button"
          onClick={() => setBulkAction('Register')}>
          <IcCheck style={{ width: 14, height: 14 }} />
          {t('label.bulk-triage')}
        </Button>
      </div>

      <div className="ai-gov-shadow-card">
        {loading ? (
          <div className="ai-gov-shadow-empty">
            <Spin size="large" />
          </div>
        ) : rows.length === 0 ? (
          <div className="ai-gov-shadow-empty">
            <IcEye className="ai-gov-shadow-empty-icon" />
            <div className="ai-gov-shadow-empty-text">
              {t('label.no-entity', { entity: t('label.shadow-ai') })}
            </div>
          </div>
        ) : (
          <table className="ai-gov-shadow-table">
            <thead>
              <tr>
                <th>{t('label.ai-asset')}</th>
                <th>{t('label.detected-from')}</th>
                <th>{t('label.volume-7d')}</th>
                <th>{t('label.suspected-user')}</th>
                <th>{t('label.team')}</th>
                <th>{t('label.severity')}</th>
                <th>{t('label.detected')}</th>
                <th>{t('label.action-plural')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.entityType}:${row.id}`}>
                  <td>
                    <div className="ai-gov-shadow-asset-cell">
                      <span className="ai-gov-shadow-asset-icon">
                        <IcAlertTri />
                      </span>
                      <div>
                        <div
                          className="ai-gov-shadow-asset-name"
                          onClick={() => handleOpenAsset(row)}>
                          {row.displayName ?? row.name}
                        </div>
                        {row.flags.length > 0 && (
                          <div className="ai-gov-shadow-flags">
                            {row.flags.map((flag) => (
                              <span className="ai-gov-shadow-flag" key={flag}>
                                {flag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="ai-gov-shadow-text">
                      {row.source
                        ? `${row.source}${
                            row.sourceDetails ? ` · ${row.sourceDetails}` : ''
                          }`
                        : '—'}
                    </span>
                  </td>
                  <td>
                    <span className="ai-gov-shadow-mono">
                      {row.volume7d ?? '—'}
                    </span>
                  </td>
                  <td>
                    <span className="ai-gov-shadow-text">
                      {row.suspectedUser ?? '—'}
                    </span>
                  </td>
                  <td>
                    <span className="ai-gov-shadow-text">
                      {row.suspectedTeam ?? '—'}
                    </span>
                  </td>
                  <td>
                    {row.severity ? (
                      <span
                        className={`ai-gov-pill ${
                          SEVERITY_PILL[row.severity] ?? 'ai-gov-pill--low'
                        }`}>
                        <span className="ai-gov-pill-dot" />
                        {row.severity}
                      </span>
                    ) : (
                      <span className="ai-gov-shadow-muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className="ai-gov-shadow-muted">
                      {formatAge(row.detectedAt)}
                    </span>
                  </td>
                  <td>
                    <div className="ai-gov-shadow-actions">
                      <Button
                        className="ai-gov-btn-sm-primary"
                        type="button"
                        onClick={() => handleRowAction(row, 'Register')}>
                        {t('label.register')}
                      </Button>
                      <Button
                        className="ai-gov-btn-sm-secondary"
                        type="button"
                        onClick={() => handleRowAction(row, 'Dismiss')}>
                        {t('label.dismiss')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        cancelText={t('label.cancel')}
        okButtonProps={{
          danger: bulkAction === 'Dismiss',
          type: 'primary',
        }}
        okText={
          bulkAction === 'Register'
            ? t('label.bulk-register')
            : t('label.bulk-dismiss')
        }
        open={Boolean(bulkAction)}
        title={t('label.confirm')}
        onCancel={() => setBulkAction(null)}
        onOk={() => bulkAction && handleBulk(bulkAction)}>
        <Typography.Paragraph>
          {bulkAction === 'Register'
            ? t('message.bulk-register-prompt', { count: rows.length })
            : t('message.bulk-dismiss-prompt', { count: rows.length })}
        </Typography.Paragraph>
      </Modal>
    </div>
  );
};

const toShadowRow = (
  entity: {
    id?: string;
    name: string;
    displayName?: string;
    fullyQualifiedName?: string;
  },
  entityType: AIGovernanceEntityType,
  detection: DetectionDetails | undefined
): ShadowRow => ({
  id: entity.id ?? '',
  name: entity.name,
  displayName: entity.displayName,
  fqn: entity.fullyQualifiedName ?? entity.name,
  entityType,
  source: detection?.source,
  sourceDetails: detection?.sourceDetails,
  volume7d: detection?.volume7d,
  suspectedUser: detection?.suspectedUser,
  suspectedTeam: detection?.suspectedTeam,
  severity: detection?.severity,
  flags: detection?.flags ?? [],
  detectedAt: detection?.detectedAt,
});

export default ShadowSection;
