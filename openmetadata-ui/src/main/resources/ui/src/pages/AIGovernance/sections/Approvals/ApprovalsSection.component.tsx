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
  approveAIAsset,
  getIntakeChecks,
  IntakeCheck,
  rejectAIAsset,
} from '../../../../rest/aiGovernanceAPI';
import { getLLMModels } from '../../../../rest/llmModelAPI';
import { getMcpServers } from '../../../../rest/mcpServerAPI';
import { getEncodedFqn } from '../../../../utils/StringsUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import {
  Button,
  Input,
  Modal,
  Spin,
  Typography,
} from '../../components/AIGovUntitled.component';
import { IcCheck, IcShield, IcX } from '../../icons/AIGovIcons';
import './approvals-section.less';

interface ApprovalRow {
  id: string;
  name: string;
  displayName?: string;
  fqn: string;
  entityType: AIGovernanceEntityType;
  description?: string;
  owner?: string;
  team?: string;
  riskClassification?: string;
  registeredAt?: number;
  registeredBy?: string;
}

const RISK_PILL: Record<string, string> = {
  Unacceptable: 'ai-gov-pill--unacceptable',
  High: 'ai-gov-pill--high',
  Limited: 'ai-gov-pill--limited',
  Minimal: 'ai-gov-pill--minimal',
};

const AVATAR_PALETTE = ['#1570EF', '#7A5AF8', '#079455', '#B54708', '#175CD3'];

const initialOf = (text: string): string =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase() || '?';

const colorFor = (text: string): string => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }

  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};

const formatSubmitted = (timestamp?: number, registeredBy?: string): string => {
  const segments: string[] = [];
  if (registeredBy) {
    segments.push(`Submitted by ${registeredBy}`);
  }
  if (timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / (60 * 1000));
    if (minutes < 60) {
      segments.push(`${Math.max(1, minutes)} min ago`);
    } else {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      if (hours < 24) {
        segments.push(`${hours} hr ago`);
      } else {
        segments.push(new Date(timestamp).toLocaleDateString());
      }
    }
  }

  return segments.join(' · ');
};

const LIST_FIELDS = 'owners,domain,tags,governanceMetadata,extension';

const ApprovalsSection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [intakeChecks, setIntakeChecks] = useState<
    Record<string, IntakeCheck[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [rejecting, setRejecting] = useState<ApprovalRow | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [apps, llms, mcps] = await Promise.allSettled([
          getAIApplications(LIST_FIELDS, { limit: 200 }),
          getLLMModels(
            undefined,
            'owners,domain,governanceStatus,deploymentInfo',
            {
              limit: 200,
            }
          ),
          getMcpServers(undefined, LIST_FIELDS, { limit: 200 }),
        ]);
        const merged: ApprovalRow[] = [];
        if (apps.status === 'fulfilled') {
          apps.value.data
            .filter(
              (a) =>
                a.governanceMetadata?.registrationStatus === 'PendingApproval'
            )
            .forEach((a) =>
              merged.push({
                id: a.id ?? '',
                name: a.name,
                displayName: a.displayName,
                fqn: a.fullyQualifiedName ?? a.name,
                entityType: 'aiApplication',
                description: a.description,
                owner: a.owners?.[0]?.displayName ?? a.owners?.[0]?.name,
                team: a.domain?.displayName ?? a.domain?.name,
                riskClassification: extractRisk(a.governanceMetadata),
                registeredAt: a.governanceMetadata?.registeredAt,
                registeredBy: a.governanceMetadata?.registeredBy,
              })
            );
        }
        if (llms.status === 'fulfilled') {
          llms.value.data
            .filter((m) => m.governanceStatus === 'PendingReview')
            .forEach((m) =>
              merged.push({
                id: m.id ?? '',
                name: m.name,
                displayName: m.displayName,
                fqn: m.fullyQualifiedName ?? m.name,
                entityType: 'llmModel',
                description: m.description,
                owner: m.owners?.[0]?.displayName ?? m.owners?.[0]?.name,
                team: m.domain?.displayName ?? m.domain?.name,
              })
            );
        }
        if (mcps.status === 'fulfilled') {
          mcps.value.data
            .filter(
              (s) =>
                s.governanceMetadata?.registrationStatus === 'PendingApproval'
            )
            .forEach((s) =>
              merged.push({
                id: s.id ?? '',
                name: s.name,
                displayName: s.displayName,
                fqn: s.fullyQualifiedName ?? s.name,
                entityType: 'mcpServer',
                description: s.description,
                owner: s.owners?.[0]?.displayName ?? s.owners?.[0]?.name,
                team: s.domain?.displayName ?? s.domain?.name,
                riskClassification: extractRisk(s.governanceMetadata),
                registeredAt: s.governanceMetadata?.registeredAt,
                registeredBy: s.governanceMetadata?.registeredBy,
              })
            );
        }
        setRows(merged);

        const checks: Record<string, IntakeCheck[]> = {};
        await Promise.all(
          merged.map(async (row) => {
            try {
              const response = await getIntakeChecks(row.entityType, row.fqn);
              checks[`${row.entityType}:${row.id}`] = response.checks;
            } catch {
              // checks are advisory
            }
          })
        );
        setIntakeChecks(checks);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [refreshKey]);

  const handleApprove = async (row: ApprovalRow) => {
    try {
      await approveAIAsset(row.entityType, row.id);
      showSuccessToast(t('message.entity-approved', { entity: row.name }));
      setRefreshKey((k) => k + 1);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleReject = async () => {
    if (!rejecting) {
      return;
    }
    try {
      await rejectAIAsset(rejecting.entityType, rejecting.id, rejectComment);
      showSuccessToast(
        t('message.entity-rejected', { entity: rejecting.name })
      );
      setRejecting(null);
      setRejectComment('');
      setRefreshKey((k) => k + 1);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleOpenDetail = (row: ApprovalRow) => {
    navigate(
      ROUTES.AI_GOVERNANCE_ASSET_DETAILS.replace(
        PLACEHOLDER_ROUTE_ENTITY_TYPE,
        row.entityType
      ).replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(row.fqn))
    );
  };

  const cards = useMemo(
    () =>
      rows.map((row) => {
        const checks = intakeChecks[`${row.entityType}:${row.id}`] ?? [];
        const passing = checks.filter((c) => c.passing).length;
        const total = checks.length;
        const submitter = row.registeredBy ?? row.owner ?? 'Unknown';
        const riskClass = row.riskClassification;
        const checksPillClass =
          total === 0 || passing < total
            ? 'ai-gov-pill ai-gov-pill--warning'
            : 'ai-gov-pill ai-gov-pill--success';

        return (
          <div className="ai-gov-app-card" key={`${row.entityType}:${row.id}`}>
            <div className="ai-gov-app-head">
              <div
                className="ai-gov-app-avatar"
                style={{ background: colorFor(submitter) }}>
                {initialOf(submitter)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}>
                  <div className="ai-gov-app-title">
                    {row.displayName ?? row.name}
                  </div>
                  {riskClass && (
                    <span
                      className={`ai-gov-pill ${
                        RISK_PILL[riskClass] ?? 'ai-gov-pill--quiet'
                      }`}>
                      <span className="ai-gov-pill-dot" />
                      {t('label.risk-class-label', { risk: riskClass })}
                    </span>
                  )}
                </div>
                <div className="ai-gov-app-sub">
                  {[
                    row.registeredBy
                      ? `Submitted by ${row.registeredBy}`
                      : row.owner
                      ? `Owner ${row.owner}`
                      : null,
                    row.team,
                    row.registeredAt
                      ? formatSubmitted(row.registeredAt).replace(
                          /^Submitted by [^·]+ · /,
                          ''
                        )
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              <div className="ai-gov-app-actions">
                <Button
                  className="ai-gov-app-btn-secondary"
                  type="button"
                  onClick={() => handleOpenDetail(row)}>
                  {t('label.open-detail')}
                </Button>
                <Button
                  className="ai-gov-app-btn-danger"
                  type="button"
                  onClick={() => setRejecting(row)}>
                  <IcX style={{ width: 14, height: 14 }} />
                  {t('label.reject')}
                </Button>
                <Button
                  className="ai-gov-app-btn-primary"
                  type="button"
                  onClick={() => handleApprove(row)}>
                  <IcCheck style={{ width: 14, height: 14 }} />
                  {t('label.approve')}
                </Button>
              </div>
            </div>
            <div className="ai-gov-app-body">
              <div>
                <div className="ai-gov-app-overline">{t('label.summary')}</div>
                <div className="ai-gov-app-summary">
                  {row.description ?? t('message.no-asset-description')}
                </div>
              </div>
              <div>
                <div className="ai-gov-app-checks-head">
                  <div className="ai-gov-app-overline">
                    {t('label.intake-checks')}
                  </div>
                  <div style={{ flex: 1 }} />
                  <span className={checksPillClass}>
                    <span className="ai-gov-pill-dot" />
                    {t('label.passing-fraction', { passed: passing, total })}
                  </span>
                </div>
                <div className="ai-gov-app-checks-list">
                  {checks.length === 0 ? (
                    <div className="ai-gov-app-check is-breached">
                      {t('message.no-intake-checks')}
                    </div>
                  ) : (
                    checks.map((c) => (
                      <div
                        className={`ai-gov-app-check ${
                          c.passing ? 'is-passing' : 'is-breached'
                        }`}
                        key={c.name}>
                        <span className="ai-gov-app-check-icon">
                          {c.passing ? <IcCheck /> : <IcX />}
                        </span>
                        {c.name}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      }),
    [rows, intakeChecks, t]
  );

  return (
    <div className="ai-gov-app">
      {loading ? (
        <div className="ai-gov-app-loader">
          <Spin size="large" />
        </div>
      ) : rows.length === 0 ? (
        <div className="ai-gov-app-empty">
          <IcShield className="ai-gov-app-empty-icon" />
          <div className="ai-gov-app-empty-text">
            {t('message.no-pending-approvals')}
          </div>
        </div>
      ) : (
        cards
      )}

      <Modal
        cancelText={t('label.cancel')}
        okButtonProps={{ danger: true }}
        okText={t('label.reject')}
        open={Boolean(rejecting)}
        title={t('label.reject-asset', { entity: rejecting?.name ?? '' })}
        onCancel={() => {
          setRejecting(null);
          setRejectComment('');
        }}
        onOk={handleReject}>
        <Typography.Paragraph>
          {t('message.reject-asset-prompt')}
        </Typography.Paragraph>
        <Input.TextArea
          placeholder={t('label.comment')}
          rows={3}
          value={rejectComment}
          onChange={(e) => setRejectComment(e.target.value)}
        />
      </Modal>
    </div>
  );
};

const extractRisk = (
  governance: { aiCompliance?: { complianceRecords?: unknown } } | undefined
): string | undefined => {
  const records = governance?.aiCompliance?.complianceRecords;
  if (!Array.isArray(records)) {
    return undefined;
  }
  for (const record of records as Array<{
    euAIAct?: { riskClassification?: string };
  }>) {
    const risk = record.euAIAct?.riskClassification;
    if (risk) {
      return risk;
    }
  }

  return undefined;
};

export default ApprovalsSection;
