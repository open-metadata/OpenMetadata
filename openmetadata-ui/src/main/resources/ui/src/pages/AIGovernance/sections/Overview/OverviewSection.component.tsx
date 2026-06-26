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

import { ChevronRight, Download01 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  PLACEHOLDER_ROUTE_ENTITY_TYPE,
  PLACEHOLDER_ROUTE_FQN,
  PLACEHOLDER_ROUTE_TAB,
  ROUTES,
} from '../../../../constants/constants';
import {
  DashboardResponse,
  getAIGovernanceDashboard,
  getGovernanceActivity,
  GovernanceActivityEvent,
  RiskMatrixCell,
} from '../../../../rest/aiGovernanceAPI';
import { getEncodedFqn } from '../../../../utils/StringsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { AIGovernanceTab } from '../../AIGovernancePage.interface';
import {
  Button,
  Card,
  Col,
  List,
  Progress,
  Row,
  Skeleton,
  Space,
  Tag,
  Typography,
} from '../../components/AIGovUntitled.component';
import {
  colorFor,
  formatAge,
  formatRelativeTime,
  initialOf,
} from '../aiGovSection.utils';
import './overview-section.less';

const FRAMEWORK_LABELS: Record<string, string> = {
  EU_AI_Act: 'EU AI Act',
  NIST_AI_RMF: 'NIST AI RMF',
  ISO_IEC_42001: 'ISO/IEC 42001',
  Singapore_Model_AI_Governance: 'Singapore MGF',
  Canada_AIDA: 'Canada AIDA',
  US_AI_Bill_of_Rights: 'US AI BoR',
  UK_AI_Regulation: 'UK AI',
  China_AI_Regulations: 'China AI',
  Custom: 'Custom',
};

const DETECTION_LABELS: Record<string, string> = {
  OutboundApiTraffic: 'Outbound API traffic',
  SSOLogs: 'SSO logs',
  ConnectorAudit: 'Connector audit',
  ManualUpload: 'Manual upload',
  Other: 'Other',
};

interface RiskMeta {
  label: string;
  dot: string;
  fg: string;
  bg: string;
}

const RISK_META: Record<string, RiskMeta> = {
  Unacceptable: {
    label: 'Unacceptable',
    dot: '#B42318',
    fg: '#7A0F0F',
    bg: '#FEE4E2',
  },
  High: {
    label: 'High',
    dot: 'var(--error-600, #D92D20)',
    fg: 'var(--error-700, #B42318)',
    bg: 'var(--error-50, #FEF3F2)',
  },
  Limited: {
    label: 'Limited',
    dot: 'var(--warning-600, #DC6803)',
    fg: 'var(--warning-700, #B54708)',
    bg: 'var(--warning-50, #FFFAEB)',
  },
  Minimal: {
    label: 'Minimal',
    dot: 'var(--success-600, #079455)',
    fg: 'var(--success-700, #067647)',
    bg: 'var(--success-50, #ECFDF3)',
  },
};

const RISK_ORDER = ['Unacceptable', 'High', 'Limited', 'Minimal'];
const IMPACT_BUCKETS = ['<1k', '1k–10k', '10k–100k', '>100k'];

const OverviewSection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [activity, setActivity] = useState<GovernanceActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [dash, act] = await Promise.all([
          getAIGovernanceDashboard(),
          getGovernanceActivity({ limit: 8 }),
        ]);
        if (!cancelled) {
          setDashboard(dash);
          setActivity(act.events);
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

  const goToTab = (tab: AIGovernanceTab) =>
    navigate(ROUTES.AI_GOVERNANCE_WITH_TAB.replace(PLACEHOLDER_ROUTE_TAB, tab));

  const goToAsset = (entityType: string, fqn: string) =>
    navigate(
      ROUTES.AI_GOVERNANCE_ASSET_DETAILS.replace(
        PLACEHOLDER_ROUTE_ENTITY_TYPE,
        entityType
      ).replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(fqn))
    );

  const euReadiness = useMemo(() => {
    if (!dashboard) {
      return 0;
    }
    const entry = dashboard.frameworkReadiness.find(
      (f) => f.framework === 'EU_AI_Act'
    );

    return entry ? Math.round(entry.readiness * 100) : 0;
  }, [dashboard]);

  if (loading || !dashboard) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  return (
    <Space className="ai-gov-overview" direction="vertical" size="middle">
      <HeroStrip
        euReadiness={euReadiness}
        highRisk={dashboard.estateStats.highRisk}
        shadow={dashboard.estateStats.shadow}
      />

      <Row gutter={[12, 12]}>
        <StatTile
          delta={t('label.this-week-delta', { count: 0 })}
          label={t('label.ai-assets-in-catalog')}
          value={dashboard.estateStats.total}
        />
        <StatTile
          color="red"
          delta={
            dashboard.estateStats.pending > 0
              ? t('label.awaiting-owner-count', {
                  count: dashboard.estateStats.pending,
                })
              : '—'
          }
          label={t('label.high-risk-classified')}
          value={dashboard.estateStats.highRisk}
        />
        <StatTile
          color="orange"
          delta={t('label.last-7-days')}
          label={t('label.shadow-ai-detected')}
          pulse={dashboard.estateStats.shadow > 0}
          value={dashboard.estateStats.shadow}
        />
        <StatTile
          color="blue"
          delta={t('label.last-7-days')}
          label={t('label.pending-approval-plural')}
          value={dashboard.estateStats.pending}
        />
        <StatTile
          color="green"
          delta={t('label.last-7-days')}
          label={t('label.eu-ai-act-readiness')}
          value={`${euReadiness}%`}
        />
      </Row>

      <Row gutter={[16, 16]}>
        <Col lg={16} xs={24}>
          <Card
            extra={
              <span className="ai-gov-live-badge">
                <span className="ai-gov-dot ai-gov-dot--live" />
                <span>{t('label.live')}</span>
              </span>
            }
            title={
              <div>
                <div>{t('label.risk-classification')}</div>
                <Typography.Text className="ai-gov-subtitle" type="secondary">
                  {t('message.risk-classification-subtitle')}
                </Typography.Text>
              </div>
            }>
            <RiskMatrix cells={dashboard.riskMatrix} />
          </Card>
        </Col>
        <Col lg={8} xs={24}>
          <Card
            extra={
              <Typography.Link
                onClick={() => goToTab(AIGovernanceTab.FRAMEWORKS)}>
                {t('label.view-all')} <ChevronRight />
              </Typography.Link>
            }
            title={
              <div>
                <div>{t('label.framework-readiness')}</div>
                <Typography.Text className="ai-gov-subtitle" type="secondary">
                  {t('message.framework-readiness-subtitle')}
                </Typography.Text>
              </div>
            }>
            <Space className="tw:w-full" direction="vertical" size="middle">
              {dashboard.frameworkReadiness.length === 0 && (
                <Typography.Text type="secondary">
                  {t('label.no-entity', {
                    entity: t('label.framework-plural'),
                  })}
                </Typography.Text>
              )}
              {dashboard.frameworkReadiness.map((fw, idx) => (
                <div
                  className={`ai-gov-framework-row${
                    fw.focus ? ' ai-gov-framework-row--focus' : ''
                  }`}
                  key={fw.framework}>
                  <Space
                    align="center"
                    className="tw:w-full tw:justify-between">
                    <Space size="small">
                      <span
                        className="ai-gov-framework-bar"
                        style={{
                          background:
                            idx === 0
                              ? 'var(--blue-600, #1570EF)'
                              : idx === 1
                              ? 'var(--purple-500, #7A5AF8)'
                              : 'var(--success-500, #17B26A)',
                        }}
                      />
                      <Typography.Text strong>
                        {FRAMEWORK_LABELS[fw.framework] ?? fw.framework}
                      </Typography.Text>
                      {fw.focus && (
                        <Tag color="blue" style={{ fontSize: 10 }}>
                          {t('label.focus')}
                        </Tag>
                      )}
                    </Space>
                    <Typography.Text
                      strong
                      style={{
                        color:
                          fw.readiness >= 0.8
                            ? 'var(--success-700, #067647)'
                            : 'var(--warning-700, #B54708)',
                        fontSize: 18,
                      }}>
                      {Math.round(fw.readiness * 100)}%
                    </Typography.Text>
                  </Space>
                  <Typography.Text className="ai-gov-subtitle" type="secondary">
                    {fw.compliant} {t('label.of-lowercase')} {fw.inScope}{' '}
                    {t('label.control-plural').toLowerCase()} {t('label.met')}
                  </Typography.Text>
                  <Progress
                    percent={Math.round(fw.readiness * 100)}
                    showInfo={false}
                    strokeColor={
                      fw.readiness >= 0.8
                        ? 'var(--success-500, #17B26A)'
                        : 'var(--warning-500, #F79009)'
                    }
                  />
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col lg={8} xs={24}>
          <Card
            extra={
              <Typography.Link onClick={() => goToTab(AIGovernanceTab.SHADOW)}>
                {t('label.view-all')} <ChevronRight />
              </Typography.Link>
            }
            title={
              <div>
                <div>{t('label.shadow-ai')}</div>
                <Typography.Text className="ai-gov-subtitle" type="secondary">
                  {t('message.shadow-ai-card-subtitle')}
                </Typography.Text>
              </div>
            }>
            <List
              dataSource={dashboard.topShadow}
              locale={{
                emptyText: t('label.no-entity', {
                  entity: t('label.shadow-ai'),
                }),
              }}
              renderItem={(item) => {
                const detail = [
                  item.detectedVia
                    ? DETECTION_LABELS[item.detectedVia] ?? item.detectedVia
                    : null,
                  item.detectedAt ? formatAge(item.detectedAt) : null,
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <List.Item
                    className="ai-gov-list-item"
                    onClick={() =>
                      goToAsset(item.entityType, item.fullyQualifiedName)
                    }>
                    <Space
                      align="center"
                      className="tw:w-full tw:justify-between">
                      <Space direction="vertical" size={0}>
                        <Typography.Text>
                          {item.displayName ?? item.name}
                        </Typography.Text>
                        {detail && (
                          <Typography.Text
                            className="ai-gov-subtitle"
                            type="secondary">
                            {detail}
                          </Typography.Text>
                        )}
                      </Space>
                      <RiskTag value={item.euRisk} />
                    </Space>
                  </List.Item>
                );
              }}
            />
          </Card>
        </Col>
        <Col lg={8} xs={24}>
          <Card
            extra={
              <Typography.Link
                onClick={() => goToTab(AIGovernanceTab.APPROVALS)}>
                {t('label.queue')} <ChevronRight />
              </Typography.Link>
            }
            title={
              <div>
                <div>{t('label.approvals-queue')}</div>
                <Typography.Text className="ai-gov-subtitle" type="secondary">
                  {t('label.pending-approval-count', {
                    count: dashboard.estateStats.pending,
                  })}
                </Typography.Text>
              </div>
            }>
            <List
              dataSource={dashboard.topApprovals}
              locale={{
                emptyText: t('label.no-entity', {
                  entity: t('label.approval-plural'),
                }),
              }}
              renderItem={(item) => {
                const submitter = item.submittedBy ?? item.name;
                const detail = [
                  item.submittedBy,
                  item.team,
                  item.submittedAt
                    ? formatRelativeTime(item.submittedAt)
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <List.Item
                    className="ai-gov-list-item"
                    onClick={() =>
                      goToAsset(item.entityType, item.fullyQualifiedName)
                    }>
                    <Space
                      align="center"
                      className="tw:w-full tw:justify-between">
                      <Space align="center" size="small">
                        <span
                          className="ai-gov-avatar"
                          style={{ background: colorFor(submitter) }}>
                          {initialOf(submitter)}
                        </span>
                        <Space direction="vertical" size={0}>
                          <Typography.Text>
                            {item.displayName ?? item.name}
                          </Typography.Text>
                          {detail && (
                            <Typography.Text
                              className="ai-gov-subtitle"
                              type="secondary">
                              {detail}
                            </Typography.Text>
                          )}
                        </Space>
                      </Space>
                      <RiskTag value={item.euRisk} />
                    </Space>
                  </List.Item>
                );
              }}
            />
          </Card>
        </Col>
        <Col lg={8} xs={24}>
          <Card
            title={
              <div>
                <div>{t('label.recent-activity')}</div>
                <Typography.Text className="ai-gov-subtitle" type="secondary">
                  {t('label.last-24-hours')}
                </Typography.Text>
              </div>
            }>
            <List
              dataSource={activity}
              locale={{
                emptyText: t('label.no-entity', {
                  entity: t('label.activity'),
                }),
              }}
              renderItem={(event) => (
                <List.Item
                  className={event.entityFqn ? 'ai-gov-list-item' : undefined}
                  onClick={() => {
                    if (event.entityType && event.entityFqn) {
                      goToAsset(event.entityType, event.entityFqn);
                    }
                  }}>
                  <Space className="tw:w-full" direction="vertical" size={2}>
                    <Typography.Text>{event.text}</Typography.Text>
                    <Typography.Text
                      className="ai-gov-subtitle"
                      type="secondary">
                      {new Date(event.createdAt ?? event.at).toLocaleString()}
                      {event.scheduledAt
                        ? ` · ${t('label.scheduled-for', {
                            date: new Date(
                              event.scheduledAt
                            ).toLocaleDateString(),
                          })}`
                        : ''}
                      {event.entityDisplayName
                        ? ` · ${event.entityDisplayName}`
                        : ''}
                    </Typography.Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
};

export const HeroStrip = ({
  euReadiness,
  highRisk,
  shadow,
}: {
  euReadiness: number;
  highRisk: number;
  shadow: number;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const attentionCount = highRisk + shadow;
  const openAuditPack = () =>
    navigate(
      `${ROUTES.AI_GOVERNANCE_WITH_TAB.replace(
        PLACEHOLDER_ROUTE_TAB,
        AIGovernanceTab.REPORTS
      )}?generate=1`
    );
  const openRiskCouncil = () =>
    navigate(
      ROUTES.AI_GOVERNANCE_WITH_TAB.replace(
        PLACEHOLDER_ROUTE_TAB,
        AIGovernanceTab.APPROVALS
      )
    );

  return (
    <div className="ai-gov-hero">
      <div className="ai-gov-hero-dots" />
      <Row align="middle" gutter={[24, 16]}>
        <Col flex="auto">
          <span className="ai-gov-hero-badge">
            <span className="ai-gov-dot ai-gov-dot--white" />
            {t('label.ai-governance')}
          </span>
          <Typography.Title className="ai-gov-hero-title" level={2}>
            {attentionCount === 0
              ? t('message.estate-fully-compliant')
              : t('message.estate-mostly-compliant', { count: attentionCount })}
          </Typography.Title>
          <Typography.Paragraph className="ai-gov-hero-sub">
            {t('message.estate-summary', {
              eu: euReadiness,
              highRisk,
              shadow,
            })}
          </Typography.Paragraph>
        </Col>
        <Col>
          <Space
            className="ai-gov-hero-actions"
            direction="vertical"
            size="small">
            <Button
              className="ai-gov-hero-btn--primary"
              icon={<Download01 />}
              onClick={openAuditPack}>
              {t('label.export-audit-pack')}
            </Button>
            <Button
              className="ai-gov-hero-btn--ghost"
              onClick={openRiskCouncil}>
              {t('label.configure-risk-council')} <ChevronRight />
            </Button>
          </Space>
        </Col>
      </Row>
    </div>
  );
};

const StatTile = ({
  label,
  value,
  delta,
  color,
  pulse,
}: {
  label: string;
  value: number | string;
  delta?: string;
  color?: 'red' | 'orange' | 'blue' | 'green';
  pulse?: boolean;
}) => {
  const tones: Record<string, { fg: string; accent: string }> = {
    red: {
      fg: 'var(--error-700, #B42318)',
      accent: 'var(--error-50, #FEF3F2)',
    },
    orange: {
      fg: 'var(--warning-700, #B54708)',
      accent: 'var(--warning-50, #FFFAEB)',
    },
    blue: { fg: 'var(--blue-700, #175CD3)', accent: 'var(--blue-50, #EFF8FF)' },
    green: {
      fg: 'var(--success-700, #067647)',
      accent: 'var(--success-50, #ECFDF3)',
    },
  };
  const tone = color ? tones[color] : undefined;

  return (
    <Col flex="1" md={4} sm={12} xs={24}>
      <Card className="ai-gov-stat-tile" size="small">
        {tone && (
          <span
            className="ai-gov-stat-corner"
            style={{ background: tone.accent }}
          />
        )}
        {pulse && <span className="ai-gov-stat-pulse" />}
        <div
          className="ai-gov-stat-value"
          style={tone ? { color: tone.fg } : undefined}>
          {value}
        </div>
        <div className="ai-gov-stat-label">{label}</div>
        {delta && <div className="ai-gov-stat-delta">{delta}</div>}
      </Card>
    </Col>
  );
};

const RiskMatrix = ({ cells }: { cells: DashboardResponse['riskMatrix'] }) => {
  const grid = useMemo(() => {
    const m = new Map<string, RiskMatrixCell>();
    cells.forEach((c) => m.set(`${c.risk}|${c.impactBucket}`, c));

    return m;
  }, [cells]);
  const { t } = useTranslation();

  return (
    <div className="ai-gov-matrix">
      <div className="ai-gov-matrix-grid">
        <div className="ai-gov-matrix-corner" />
        {IMPACT_BUCKETS.map((bucket) => (
          <div className="ai-gov-matrix-header" key={bucket}>
            {bucket}
          </div>
        ))}
        {RISK_ORDER.map((risk) => {
          const meta = RISK_META[risk];
          const isHot = risk === 'High' || risk === 'Unacceptable';

          return (
            <div className="ai-gov-matrix-row" key={risk}>
              <div className="ai-gov-matrix-label">
                <span
                  className="ai-gov-matrix-dot"
                  style={{ background: meta.dot }}
                />
                <span style={{ color: meta.fg, fontWeight: 600 }}>
                  {meta.label}
                </span>
              </div>
              {IMPACT_BUCKETS.map((bucket) => {
                const cell = grid.get(`${risk}|${bucket}`);
                const count = cell?.count ?? 0;
                const topEntity = cell?.topEntity;
                const intensity = Math.max(0.4, Math.min(1, count / 9));
                const bg =
                  count === 0
                    ? 'var(--gray-25, #FAFAFA)'
                    : `color-mix(in oklch, ${meta.bg} ${
                        intensity * 100
                      }%, transparent)`;

                return (
                  <div
                    className={
                      count === 0
                        ? 'ai-gov-matrix-cell ai-gov-matrix-cell--empty'
                        : 'ai-gov-matrix-cell'
                    }
                    key={`${risk}-${bucket}`}
                    style={{
                      background: bg,
                      borderColor: count === 0 ? undefined : meta.bg,
                      color: count === 0 ? 'var(--gray-500, #717680)' : meta.fg,
                    }}>
                    <span className="ai-gov-matrix-cell-count">{count}</span>
                    {topEntity && (
                      <span className="ai-gov-matrix-cell-entity">
                        {topEntity.displayName ?? topEntity.name}
                      </span>
                    )}
                    {isHot && count > 0 && (
                      <span
                        className="ai-gov-matrix-pulse"
                        style={{ background: meta.dot }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <Typography.Text className="ai-gov-matrix-caption" type="secondary">
        {t('label.affected-users-impact')} →
      </Typography.Text>
    </div>
  );
};

const RiskTag = ({ value }: { value?: string }) => {
  if (!value) {
    return null;
  }
  const meta = RISK_META[value];
  if (!meta) {
    return <Tag>{value}</Tag>;
  }

  return (
    <span
      className="ai-gov-risk-pill"
      style={{ background: meta.bg, color: meta.fg }}>
      <span className="ai-gov-dot" style={{ background: meta.dot }} />
      {meta.label}
    </span>
  );
};

export default OverviewSection;
