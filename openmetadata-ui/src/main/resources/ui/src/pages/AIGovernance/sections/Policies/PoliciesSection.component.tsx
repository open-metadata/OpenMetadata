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
import { AIGovernancePolicy } from '../../../../generated/entity/ai/aiGovernancePolicy';
import {
  getPolicyViolations,
  listPolicies,
  PolicyViolation,
} from '../../../../rest/aiGovernancePolicyAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { Button, Spin } from '../../components/AIGovUntitled.component';
import {
  IcAlertCirc,
  IcAlertTri,
  IcClock,
  IcShield,
  IcShieldTick,
  IcTrending,
  IcUsers,
} from '../../icons/AIGovIcons';
import './policies-section.less';

interface PolicyRow extends AIGovernancePolicy {
  breachedCount?: number;
  passingCount?: number;
}

const SEVERITY_PILL: Record<string, string> = {
  Critical: 'ai-gov-pill--error',
  High: 'ai-gov-pill--error',
  Medium: 'ai-gov-pill--warning',
  Low: 'ai-gov-pill--info',
};

const ENFORCEMENT_PILL: Record<string, string> = {
  Blocking: 'ai-gov-pill--error',
  Warning: 'ai-gov-pill--warning',
  Advisory: 'ai-gov-pill--info',
};

const describeAppliesTo = (policy: AIGovernancePolicy): string => {
  const segments: string[] = [];
  if (policy.policyType) {
    segments.push(policy.policyType);
  }
  if (policy.appliesTo && policy.appliesTo.length > 0) {
    segments.push(`${policy.appliesTo.length} scoped assets`);
  } else {
    segments.push('Whole estate');
  }

  return segments.join(' · ');
};

const formatTimeAgo = (timestamp?: number): string => {
  if (!timestamp) {
    return '—';
  }
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / (60 * 1000));
  if (minutes < 60) {
    return `${Math.max(1, minutes)} min ago`;
  }
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 24) {
    return `${hours} hr ago`;
  }
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));

  return `${days} days ago`;
};

const PoliciesSection = () => {
  const { t } = useTranslation();
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [violations, setViolations] = useState<PolicyViolation[]>([]);
  const [violationsLoading, setViolationsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const response = await listPolicies({ limit: 100 });
        if (!cancelled) {
          setPolicies(response.data);
        }
      } catch (error) {
        if (!cancelled) {
          showErrorToast(error as AxiosError);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadViolations = async () => {
      setViolationsLoading(true);
      try {
        const collected: PolicyViolation[] = [];
        const targets = policies.slice(0, 5);
        for (const policy of targets) {
          if (!policy.id) {
            continue;
          }
          try {
            const response = await getPolicyViolations(policy.id, {
              limit: 10,
            });
            collected.push(...response.data);
          } catch {
            // skip
          }
        }
        if (!cancelled) {
          const sorted = collected
            .filter((v) => v.observedAt > 0)
            .sort((a, b) => b.observedAt - a.observedAt)
            .slice(0, 12);
          setViolations(sorted);
        }
      } finally {
        if (!cancelled) {
          setViolationsLoading(false);
        }
      }
    };
    if (policies.length > 0) {
      loadViolations();
    } else {
      setViolations([]);
      setViolationsLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [policies]);

  const stats = useMemo(() => {
    const totalPolicies = policies.length;
    const breachedToday = violations.filter(
      (v) => Date.now() - v.observedAt < 24 * 60 * 60 * 1000
    ).length;
    const assetsAffected = new Set(
      violations.filter((v) => v.entityId).map((v) => v.entityId)
    ).size;

    return { totalPolicies, breachedToday, assetsAffected };
  }, [policies, violations]);

  return (
    <div className="ai-gov-pol">
      <div className="ai-gov-pol-intent">
        <div className="ai-gov-pol-intent-icon">
          <IcShield />
        </div>
        <div style={{ flex: 1 }}>
          <div className="ai-gov-pol-intent-title">
            {t('message.policies-intent-title')}
          </div>
          <div className="ai-gov-pol-intent-sub">
            {t('message.policies-intent-sub')}
          </div>
        </div>
        <Button disabled className="ai-gov-pol-btn-primary" type="button">
          {t('label.create-policy')}
        </Button>
      </div>

      <div className="ai-gov-pol-stats">
        <div className="ai-gov-pol-stat is-info">
          <div className="ai-gov-pol-stat-icon">
            <IcShieldTick />
          </div>
          <div className="ai-gov-pol-stat-value">{stats.totalPolicies}</div>
          <div className="ai-gov-pol-stat-label">
            {t('label.total-policies')}
          </div>
        </div>
        <div className="ai-gov-pol-stat is-error">
          <div className="ai-gov-pol-stat-icon">
            <IcAlertTri />
          </div>
          <div className="ai-gov-pol-stat-value">{stats.breachedToday}</div>
          <div className="ai-gov-pol-stat-label">
            {t('label.breached-today')}
          </div>
        </div>
        <div className="ai-gov-pol-stat is-warning">
          <div className="ai-gov-pol-stat-icon">
            <IcUsers />
          </div>
          <div className="ai-gov-pol-stat-value">{stats.assetsAffected}</div>
          <div className="ai-gov-pol-stat-label">
            {t('label.assets-affected')}
          </div>
        </div>
        <div className="ai-gov-pol-stat is-success">
          <div className="ai-gov-pol-stat-icon">
            <IcTrending />
          </div>
          <div className="ai-gov-pol-stat-value">—</div>
          <div className="ai-gov-pol-stat-label">
            {t('label.avg-remediation-time')}
          </div>
        </div>
      </div>

      <div>
        <div className="ai-gov-pol-section-head">
          <div className="ai-gov-pol-section-title">
            {t('label.active-policies')}
          </div>
          <span className="ai-gov-pill ai-gov-pill--success">
            <span className="ai-gov-pill-dot" />
            {t('label.count-enabled', { count: policies.length })}
          </span>
          <div className="ai-gov-pol-spacer" />
        </div>
        <div className="ai-gov-pol-card">
          {loading ? (
            <div className="ai-gov-pol-empty">
              <Spin size="large" />
            </div>
          ) : policies.length === 0 ? (
            <div className="ai-gov-pol-empty">
              <IcShield className="ai-gov-pol-empty-icon" />
              <div className="ai-gov-pol-empty-text">
                {t('message.no-policies-yet')}
              </div>
            </div>
          ) : (
            <table className="ai-gov-pol-table">
              <thead>
                <tr>
                  <th>{t('label.policy')}</th>
                  <th>{t('label.severity')}</th>
                  <th>{t('label.scope')}</th>
                  <th>{t('label.enforcement')}</th>
                  <th>{t('label.last-updated')}</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((policy) => {
                  const severity =
                    (policy.rules ?? []).find((r) => r.severity)?.severity ??
                    '';
                  const enforcement = policy.enforcementLevel ?? '';

                  return (
                    <tr key={policy.id}>
                      <td>
                        <div className="ai-gov-pol-name-cell">
                          <span className="ai-gov-pol-name-icon">
                            <IcShield />
                          </span>
                          <div>
                            <div className="ai-gov-pol-name">
                              {policy.displayName ?? policy.name}
                            </div>
                            {policy.description && (
                              <div
                                className="ai-gov-pol-name-sub"
                                style={{ maxWidth: 360 }}>
                                {policy.description.slice(0, 110)}
                                {policy.description.length > 110 ? '…' : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        {severity ? (
                          <span
                            className={`ai-gov-pill ${
                              SEVERITY_PILL[severity] ?? 'ai-gov-pill--quiet'
                            }`}>
                            <span className="ai-gov-pill-dot" />
                            {severity}
                          </span>
                        ) : (
                          <span className="ai-gov-pol-cell-muted">—</span>
                        )}
                      </td>
                      <td>
                        <span className="ai-gov-pol-cell-text">
                          {describeAppliesTo(policy)}
                        </span>
                      </td>
                      <td>
                        {enforcement ? (
                          <span
                            className={`ai-gov-pill ${
                              ENFORCEMENT_PILL[enforcement] ??
                              'ai-gov-pill--quiet'
                            }`}>
                            {enforcement}
                          </span>
                        ) : (
                          <span className="ai-gov-pol-cell-muted">—</span>
                        )}
                      </td>
                      <td>
                        <span className="ai-gov-pol-cell-muted">
                          {formatTimeAgo(policy.updatedAt)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="ai-gov-pol-violations">
        <div className="ai-gov-pol-violations-head">
          <IcClock />
          {t('label.recent-policy-breaches')}
        </div>
        {violationsLoading ? (
          <div className="ai-gov-pol-violations-empty">
            <Spin size="small" />
          </div>
        ) : violations.length === 0 ? (
          <div className="ai-gov-pol-violations-empty">
            {t('message.no-policy-breaches')}
          </div>
        ) : (
          violations.map((v, idx) => (
            <div
              className="ai-gov-pol-violation-row"
              key={`${v.entityId}-${idx}`}>
              <span className="ai-gov-pol-violation-icon">
                <IcAlertCirc />
              </span>
              <div style={{ flex: 1 }}>
                <div className="ai-gov-pol-violation-name">
                  {v.entityName ?? v.entityId} — {v.ruleName}
                </div>
                <div className="ai-gov-pol-violation-meta">
                  {v.value ?? ''} · {formatTimeAgo(v.observedAt)}
                </div>
              </div>
              <span className="ai-gov-pill ai-gov-pill--error">
                <span className="ai-gov-pill-dot" />
                {t('label.breached')}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PoliciesSection;
