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
import { isEmpty } from 'lodash';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  PLACEHOLDER_ROUTE_ENTITY_TYPE,
  PLACEHOLDER_ROUTE_FQN,
  ROUTES,
} from '../../../../constants/constants';
import { SearchIndex } from '../../../../enums/search.enum';
import {
  AIApplicationSearchSource,
  LlmModelSearchSource,
  McpServerSearchSource,
} from '../../../../interface/search.interface';
import { searchQuery } from '../../../../rest/searchAPI';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../../../utils/StringsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import {
  Button,
  Input,
  Select,
  Spin,
} from '../../components/AIGovUntitled.component';
import {
  IcAlertTri,
  IcBrain,
  IcChevR,
  IcCpu,
  IcFilter,
  IcPlus,
  IcScale,
  IcSearchLg,
  IcServer,
  IcSparkle,
} from '../../icons/AIGovIcons';
import './registry-section.less';
import {
  AIAssetRegistryRow,
  RegistryAssetType,
  RegistryFramework,
  RegistryRiskFilter,
} from './Registry.types';
import {
  aiApplicationToRow,
  llmModelToRow,
  mcpServerToRow,
} from './Registry.utils';

const PAGE_SIZE = 100;

const AI_ASSET_SEARCH_INDEXES = [
  SearchIndex.AI_APPLICATION,
  SearchIndex.LLM_MODEL,
  SearchIndex.MCP_SERVER,
];

type AIAssetSearchSource =
  | AIApplicationSearchSource
  | LlmModelSearchSource
  | McpServerSearchSource;

const AVATAR_PALETTE = ['#1570EF', '#7A5AF8', '#079455', '#B54708', '#175CD3'];

const ASSET_TYPE_LABELS: Record<RegistryAssetType, string> = {
  [RegistryAssetType.ALL]: 'label.all',
  [RegistryAssetType.APPLICATION]: 'label.application-plural',
  [RegistryAssetType.AGENT]: 'label.agent-plural',
  [RegistryAssetType.LLM]: 'label.llm-model-plural',
  [RegistryAssetType.MCP]: 'label.mcp-server-plural',
};

const ASSET_TYPE_BADGE: Record<RegistryAssetType, string> = {
  [RegistryAssetType.ALL]: 'label.ai-asset-plural',
  [RegistryAssetType.APPLICATION]: 'label.ai-application',
  [RegistryAssetType.AGENT]: 'label.ai-agent',
  [RegistryAssetType.LLM]: 'label.llm-model',
  [RegistryAssetType.MCP]: 'label.mcp-server',
};

const FRAMEWORK_LABELS: Record<RegistryFramework, string> = {
  [RegistryFramework.EU_AI_ACT]: 'EU AI Act',
  [RegistryFramework.NIST_AI_RMF]: 'NIST AI RMF',
  [RegistryFramework.ISO_IEC_42001]: 'ISO/IEC 42001',
  [RegistryFramework.SINGAPORE_MGF]: 'Singapore MGF',
  [RegistryFramework.CANADA_AIDA]: 'Canada AIDA',
  [RegistryFramework.US_BILL_OF_RIGHTS]: 'US AI BoR',
  [RegistryFramework.UK_AI]: 'UK AI',
  [RegistryFramework.CHINA_AI]: 'China AI',
  [RegistryFramework.CUSTOM]: 'Custom',
};

const RISK_PILL_CLASS: Record<
  NonNullable<AIAssetRegistryRow['riskClassification']>,
  string
> = {
  Unacceptable: 'ai-gov-pill--unacceptable',
  High: 'ai-gov-pill--high',
  Limited: 'ai-gov-pill--limited',
  Minimal: 'ai-gov-pill--minimal',
};

const STATUS_PILL: Record<
  NonNullable<AIAssetRegistryRow['frameworkStatuses'][RegistryFramework]>,
  { cls: string; key: string }
> = {
  Compliant: { cls: 'ai-gov-pill--compliant', key: 'label.compliant' },
  PartiallyCompliant: {
    cls: 'ai-gov-pill--partial',
    key: 'label.partially-compliant',
  },
  NonCompliant: {
    cls: 'ai-gov-pill--noncompliant',
    key: 'label.non-compliant',
  },
  UnderReview: { cls: 'ai-gov-pill--review', key: 'label.under-review' },
  NotApplicable: { cls: 'ai-gov-pill--neutral', key: 'label.not-applicable' },
};

const ASSET_ICON: Record<RegistryAssetType, ReactNode> = {
  [RegistryAssetType.ALL]: <IcCpu />,
  [RegistryAssetType.APPLICATION]: <IcCpu />,
  [RegistryAssetType.AGENT]: <IcSparkle />,
  [RegistryAssetType.LLM]: <IcBrain />,
  [RegistryAssetType.MCP]: <IcServer />,
};

const ASSET_ICON_CLASS: Record<RegistryAssetType, string> = {
  [RegistryAssetType.ALL]: 'is-app',
  [RegistryAssetType.APPLICATION]: 'is-app',
  [RegistryAssetType.AGENT]: 'is-agent',
  [RegistryAssetType.LLM]: 'is-llm',
  [RegistryAssetType.MCP]: 'is-mcp',
};

const initialOf = (text: string): string =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase() || '?';

const avatarColor = (text: string): string => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }

  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};

interface RegistrySectionProps {
  refreshKey: number;
  onOpenIntake: () => void;
}

const searchSourceToRow = (
  source: AIAssetSearchSource
): AIAssetRegistryRow | undefined => {
  switch (source.entityType) {
    case SearchIndex.AI_APPLICATION:
      return aiApplicationToRow(source);
    case SearchIndex.LLM_MODEL:
      return llmModelToRow(source);
    case SearchIndex.MCP_SERVER:
      return mcpServerToRow(source);
    default:
      return undefined;
  }
};

const RegistrySection = ({
  onOpenIntake,
  refreshKey,
}: RegistrySectionProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [rows, setRows] = useState<AIAssetRegistryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchText, setSearchText] = useState('');
  const [assetType, setAssetType] = useState<RegistryAssetType>(
    RegistryAssetType.ALL
  );
  const [riskFilter, setRiskFilter] = useState<RegistryRiskFilter>(
    RegistryRiskFilter.ALL
  );
  const [framework, setFramework] = useState<RegistryFramework>(
    RegistryFramework.EU_AI_ACT
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchText(search.trim()), 250);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const fetchAssets = async () => {
      setLoading(true);
      try {
        const query = searchText
          ? `*${getEncodedFqn(escapeESReservedCharacters(searchText))}*`
          : '**';
        const response = await searchQuery({
          query,
          pageSize: PAGE_SIZE,
          searchIndex: AI_ASSET_SEARCH_INDEXES,
          fetchSource: true,
        });

        setRows(
          response.hits.hits
            .map((hit) => searchSourceToRow(hit._source as AIAssetSearchSource))
            .filter((row): row is AIAssetRegistryRow => Boolean(row))
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setLoading(false);
      }
    };
    fetchAssets();
  }, [refreshKey, searchText]);

  const counts = useMemo(() => {
    const byType: Record<RegistryAssetType, number> = {
      [RegistryAssetType.ALL]: rows.length,
      [RegistryAssetType.APPLICATION]: 0,
      [RegistryAssetType.AGENT]: 0,
      [RegistryAssetType.LLM]: 0,
      [RegistryAssetType.MCP]: 0,
    };
    rows.forEach((row) => {
      byType[row.assetType] += 1;
    });

    return byType;
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (assetType !== RegistryAssetType.ALL && row.assetType !== assetType) {
        return false;
      }
      if (
        riskFilter !== RegistryRiskFilter.ALL &&
        row.riskClassification !== riskFilter
      ) {
        return false;
      }

      return true;
    });
  }, [rows, assetType, riskFilter]);

  const handleRowClick = (row: AIAssetRegistryRow) => {
    navigate(
      ROUTES.AI_GOVERNANCE_ASSET_DETAILS.replace(
        PLACEHOLDER_ROUTE_ENTITY_TYPE,
        row.entityType
      ).replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(row.fullyQualifiedName))
    );
  };

  const segmentItems = [
    RegistryAssetType.ALL,
    RegistryAssetType.APPLICATION,
    RegistryAssetType.LLM,
    RegistryAssetType.MCP,
    RegistryAssetType.AGENT,
  ];

  const riskOptions: { id: RegistryRiskFilter; label: string }[] = [
    { id: RegistryRiskFilter.ALL, label: t('label.any-risk') },
    { id: RegistryRiskFilter.UNACCEPTABLE, label: t('label.unacceptable') },
    { id: RegistryRiskFilter.HIGH, label: t('label.high') },
    { id: RegistryRiskFilter.LIMITED, label: t('label.limited') },
    { id: RegistryRiskFilter.MINIMAL, label: t('label.minimal') },
  ];

  const frameworkOptions = (
    Object.values(RegistryFramework) as RegistryFramework[]
  ).map((id) => ({ id, label: FRAMEWORK_LABELS[id] }));

  return (
    <div className="ai-gov-registry">
      <div className="ai-gov-registry-filterbar">
        <Input
          className="ai-gov-search"
          icon={IcSearchLg}
          placeholder={t('label.search-assets')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="ai-gov-segment" role="tablist">
          {segmentItems.map((id) => (
            <Button
              className={`ai-gov-segment-item ${
                assetType === id ? 'is-active' : ''
              }`}
              key={id}
              role="tab"
              type="button"
              onClick={() => setAssetType(id)}>
              {t(ASSET_TYPE_LABELS[id])}
              <span className="ai-gov-segment-count">{counts[id] ?? 0}</span>
            </Button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div className="ai-gov-pill-select">
          <IcAlertTri
            className="ai-gov-pill-select-icon"
            style={{ width: 14, height: 14 }}
          />
          <Select
            options={riskOptions.map((o) => ({ label: o.label, value: o.id }))}
            value={riskFilter}
            onChange={setRiskFilter}
          />
        </div>

        <div className="ai-gov-pill-select">
          <IcScale
            className="ai-gov-pill-select-icon"
            style={{ width: 14, height: 14 }}
          />
          <Select
            options={frameworkOptions.map((o) => ({
              label: o.label,
              value: o.id,
            }))}
            value={framework}
            onChange={setFramework}
          />
        </div>

        <Button className="ai-gov-secondary-btn" type="button">
          <IcFilter style={{ width: 14, height: 14 }} />
          {t('label.filter-plural')}
        </Button>

        <Button
          className="ai-gov-primary-btn"
          type="button"
          onClick={onOpenIntake}>
          <IcPlus style={{ width: 14, height: 14 }} />
          {t('label.register')}
        </Button>
      </div>

      <div className="ai-gov-registry-table-wrap">
        {loading ? (
          <div className="ai-gov-registry-empty">
            <Spin size="large" />
          </div>
        ) : isEmpty(filtered) ? (
          <div className="ai-gov-registry-empty">
            <IcCpu className="ai-gov-empty-icon" />
            <div className="ai-gov-empty-text">
              {t('message.no-data-available')}
            </div>
          </div>
        ) : (
          <table className="ai-gov-registry-table">
            <thead>
              <tr>
                <th>{t('label.asset')}</th>
                <th>{t('label.type')}</th>
                <th>{t('label.owner')}</th>
                <th>{t('label.risk')}</th>
                <th>
                  {`${t('label.status')} · ${FRAMEWORK_LABELS[framework]}`}
                </th>
                <th>{t('label.pii-uppercase')}</th>
                <th>{t('label.region')}</th>
                <th>{t('label.last-assessed')}</th>
                <th aria-label="open" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const status = row.frameworkStatuses[framework];
                const statusMeta = status ? STATUS_PILL[status] : null;
                const owner = row.owners?.[0];
                const ownerLabel = owner?.displayName ?? owner?.name ?? '';

                return (
                  <tr
                    key={`${row.entityType}:${row.id}`}
                    onClick={() => handleRowClick(row)}>
                    <td>
                      <div className="ai-gov-asset-cell">
                        <span
                          className={`ai-gov-asset-icon ${
                            ASSET_ICON_CLASS[row.assetType]
                          }`}>
                          {ASSET_ICON[row.assetType]}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div className="ai-gov-asset-name">
                            {row.displayName ?? row.name}
                          </div>
                          <div className="ai-gov-asset-sub">
                            {[row.domain, row.deployment]
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="ai-gov-type-pill">
                        {t(ASSET_TYPE_BADGE[row.assetType])}
                      </span>
                    </td>
                    <td>
                      <div className="ai-gov-owner-cell">
                        {owner ? (
                          <>
                            <span
                              className="ai-gov-owner-avatar"
                              style={{
                                background: avatarColor(ownerLabel),
                              }}>
                              {initialOf(ownerLabel)}
                            </span>
                            <span className="ai-gov-cell-text">
                              {ownerLabel}
                              {row.owners.length > 1
                                ? ` +${row.owners.length - 1}`
                                : ''}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="ai-gov-owner-unassigned" />
                            <span className="ai-gov-owner-unassigned-text">
                              {t('label.unassigned')}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td>
                      {row.riskClassification ? (
                        <span
                          className={`ai-gov-pill ${
                            RISK_PILL_CLASS[row.riskClassification]
                          }`}>
                          <span className="ai-gov-pill-dot" />
                          {row.riskClassification}
                        </span>
                      ) : (
                        <span className="ai-gov-cell-muted">—</span>
                      )}
                    </td>
                    <td>
                      {statusMeta ? (
                        <span className={`ai-gov-pill ${statusMeta.cls}`}>
                          {t(statusMeta.key)}
                        </span>
                      ) : (
                        <span className="ai-gov-cell-muted">—</span>
                      )}
                    </td>
                    <td>
                      {row.accessesPii ? (
                        <span className="ai-gov-pill ai-gov-pill--pii">
                          <span className="ai-gov-pill-dot" />
                          {t('label.pii-uppercase')}
                        </span>
                      ) : (
                        <span className="ai-gov-cell-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className="ai-gov-cell-text">
                        {row.regions.length ? row.regions.join(', ') : '—'}
                      </span>
                    </td>
                    <td>
                      <span className="ai-gov-cell-text">
                        {row.lastAssessedAt
                          ? new Date(row.lastAssessedAt).toLocaleDateString()
                          : '—'}
                      </span>
                    </td>
                    <td className="ai-gov-chev-cell">
                      <IcChevR />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default RegistrySection;
