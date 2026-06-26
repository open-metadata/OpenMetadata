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
import { PLACEHOLDER_ROUTE_FQN, ROUTES } from '../../../../constants/constants';
import {
  AIGovernanceFramework,
  AssessmentCadence,
  createFramework,
  FrameworkSource,
  getFrameworkCoverage,
  listFrameworks,
  toggleFrameworkEnabled,
} from '../../../../rest/aiGovernanceFrameworkAPI';
import { getEncodedFqn } from '../../../../utils/StringUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import {
  Button,
  Input,
  Modal,
  Spin,
} from '../../components/AIGovUntitled.component';
import {
  IcCheck,
  IcChevR,
  IcCopy,
  IcDownload,
  IcExternal,
  IcFile,
  IcPlus,
  IcScale,
  IcX,
} from '../../icons/AIGovIcons';
import './frameworks-section.less';

interface FrameworkWithCoverage extends AIGovernanceFramework {
  controlsMet?: number;
  controlsTotal?: number;
  assetsInScope?: number;
}

const ACCENT_PALETTE = [
  '#1570EF',
  '#7A5AE0',
  '#0E9384',
  '#DC6803',
  '#7A5AF8',
  '#0BA5EC',
  '#067647',
  '#B54708',
  '#5925DC',
];

const SOURCE_PILL: Record<FrameworkSource, { cls: string; key: string }> = {
  BuiltIn: { cls: 'ai-gov-fw-pill--builtin', key: 'label.built-in' },
  Custom: { cls: 'ai-gov-fw-pill--custom', key: 'label.custom' },
  ForkedFrom: { cls: 'ai-gov-fw-pill--forked', key: 'label.forked' },
};

const STEWARD_PALETTE = ['#1570EF', '#7A5AF8', '#079455', '#B54708', '#175CD3'];

const initialOf = (text: string): string =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase() || '?';

const colorFor = (text: string, palette: string[]): string => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }

  return palette[Math.abs(hash) % palette.length];
};

const FrameworksSection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [frameworks, setFrameworks] = useState<FrameworkWithCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const response = await listFrameworks({ limit: 100 });
        if (cancelled) {
          return;
        }
        const enriched = await Promise.all(
          response.data.map(async (fw) => {
            if (!fw.id || !fw.enabled) {
              return fw;
            }
            try {
              const coverage = await getFrameworkCoverage(fw.id);
              const total = coverage.controls.length;
              const met = coverage.controls.filter(
                (c) => c.status === 'Met'
              ).length;

              return {
                ...fw,
                controlsMet: met,
                controlsTotal: total,
                assetsInScope: coverage.assetsInScope ?? 0,
              };
            } catch {
              return fw;
            }
          })
        );
        if (!cancelled) {
          setFrameworks(enriched);
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
  }, [refreshKey]);

  const activeFrameworks = useMemo(
    () => frameworks.filter((fw) => fw.enabled),
    [frameworks]
  );
  const libraryFrameworks = useMemo(
    () => frameworks.filter((fw) => !fw.enabled),
    [frameworks]
  );

  const goToFramework = (fqn?: string) => {
    if (fqn) {
      navigate(
        ROUTES.AI_GOVERNANCE_FRAMEWORK_DETAILS.replace(
          PLACEHOLDER_ROUTE_FQN,
          getEncodedFqn(fqn)
        )
      );
    }
  };

  const handleToggle = async (fw: FrameworkWithCoverage, enabled: boolean) => {
    if (!fw.id) {
      return;
    }
    setTogglingId(fw.id);
    try {
      await toggleFrameworkEnabled(fw, enabled);
      showSuccessToast(
        t(
          enabled ? 'message.framework-enabled' : 'message.framework-disabled',
          {
            name: fw.displayName ?? fw.name,
          }
        )
      );
      setRefreshKey((k) => k + 1);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="ai-gov-fw">
      <div className="ai-gov-fw-intent">
        <div className="ai-gov-fw-intent-icon">
          <IcScale />
        </div>
        <div style={{ flex: 1 }}>
          <div className="ai-gov-fw-intent-title">
            {t('message.frameworks-intent-title')}
          </div>
          <div className="ai-gov-fw-intent-sub">
            {t('message.frameworks-intent-sub')}
          </div>
        </div>
        <Button className="ai-gov-fw-btn-secondary" type="button">
          <IcExternal style={{ width: 13, height: 13 }} />
          {t('label.how-frameworks-work')}
        </Button>
      </div>

      {loading ? (
        <div className="ai-gov-fw-loader">
          <Spin size="large" />
        </div>
      ) : (
        <>
          <div>
            <div className="ai-gov-fw-section-head">
              <div className="ai-gov-fw-section-title">
                {t('label.active-frameworks')}
              </div>
              <span className="ai-gov-fw-pill ai-gov-fw-pill--success">
                <span className="ai-gov-fw-pill-dot" />
                {t('label.count-enabled', { count: activeFrameworks.length })}
              </span>
              <div className="ai-gov-fw-spacer" />
            </div>
            <div className="ai-gov-fw-active-grid">
              {activeFrameworks.map((fw) => (
                <ActiveFrameworkCard
                  fw={fw}
                  key={fw.id}
                  onOpen={() => goToFramework(fw.fullyQualifiedName)}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="ai-gov-fw-section-head">
              <div className="ai-gov-fw-section-title">
                {t('label.framework-library')}
              </div>
              <span className="ai-gov-fw-pill ai-gov-fw-pill--quiet">
                {t('label.count-available', {
                  count: libraryFrameworks.length,
                })}
              </span>
              <div className="ai-gov-fw-spacer" />
              <Button
                className="ai-gov-fw-btn-secondary"
                style={{ height: 30, fontSize: 12 }}
                type="button">
                <IcDownload style={{ width: 12, height: 12 }} />
                {t('label.import-from-csv')}
              </Button>
              <Button
                className="ai-gov-fw-btn-primary"
                style={{ height: 30, fontSize: 12 }}
                type="button"
                onClick={() => setCreateOpen(true)}>
                <IcPlus style={{ width: 12, height: 12 }} />
                {t('label.create-custom-framework')}
              </Button>
            </div>
            <div className="ai-gov-fw-library-grid">
              {libraryFrameworks.map((fw) => (
                <LibraryCard
                  fw={fw}
                  key={fw.id}
                  loading={togglingId === fw.id}
                  onEnable={() => handleToggle(fw, true)}
                  onOpen={() => goToFramework(fw.fullyQualifiedName)}
                />
              ))}
              <CustomFrameworkCard onClick={() => setCreateOpen(true)} />
            </div>
          </div>
        </>
      )}

      <CreateFrameworkModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
};

const ActiveFrameworkCard = ({
  fw,
  onOpen,
}: {
  fw: FrameworkWithCoverage;
  onOpen: () => void;
}) => {
  const { t } = useTranslation();
  const accent = colorFor(fw.name, ACCENT_PALETTE);
  const total = fw.controlsTotal ?? 0;
  const met = fw.controlsMet ?? 0;
  const pct = total === 0 ? 0 : Math.round((met / total) * 100);
  const autoApplyTo = describeAutoApply(fw);
  const cadence = fw.assessmentCadence ?? '—';
  const nextDeadline = fw.nextDeadline
    ? new Date(fw.nextDeadline).toLocaleDateString()
    : '—';

  return (
    <div className="ai-gov-fw-active-card" onClick={onOpen}>
      <div className="ai-gov-fw-active-body" style={{ borderTopColor: accent }}>
        <div className="ai-gov-fw-active-head">
          <div
            className="ai-gov-fw-active-icon"
            style={{
              background: `color-mix(in srgb, ${accent} 10%, white)`,
              color: accent,
            }}>
            <IcScale />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ai-gov-fw-active-name">
              {fw.displayName ?? fw.name}
            </div>
            <div className="ai-gov-fw-active-ref">{fw.reference ?? '—'}</div>
          </div>
          <span className="ai-gov-fw-pill ai-gov-fw-pill--success">
            <span className="ai-gov-fw-pill-dot" />
            {t('label.enabled')}
          </span>
        </div>

        <div className="ai-gov-fw-coverage">
          <div className="ai-gov-fw-coverage-row">
            <div className="ai-gov-fw-coverage-pct">{pct}%</div>
            <div className="ai-gov-fw-coverage-detail">
              {t('label.controls-met-of-total', { met, total })}
            </div>
          </div>
          <div className="ai-gov-fw-coverage-bar">
            <div
              className="ai-gov-fw-coverage-fill"
              style={{ width: `${pct}%`, background: accent }}
            />
          </div>
        </div>

        <div className="ai-gov-fw-meta-grid">
          <div>
            <div className="ai-gov-fw-meta-label">
              {t('label.auto-applies-to')}
            </div>
            <div className="ai-gov-fw-meta-value">{autoApplyTo}</div>
          </div>
          <div>
            <div className="ai-gov-fw-meta-label">{t('label.in-scope')}</div>
            <div className="ai-gov-fw-meta-value">
              {t('label.count-assets', { count: fw.assetsInScope ?? 0 })}
            </div>
          </div>
          <div>
            <div className="ai-gov-fw-meta-label">{t('label.cadence')}</div>
            <div className="ai-gov-fw-meta-value">{cadence}</div>
          </div>
          <div>
            <div className="ai-gov-fw-meta-label">
              {t('label.next-deadline')}
            </div>
            <div className="ai-gov-fw-meta-value">{nextDeadline}</div>
          </div>
        </div>
      </div>
      <div className="ai-gov-fw-active-footer">
        <div className="ai-gov-fw-stewards">
          {(fw.stewards ?? []).slice(0, 3).map((s) => {
            const label = s.displayName ?? s.name ?? '?';

            return (
              <span
                className="ai-gov-fw-steward-avatar"
                key={s.id}
                style={{ background: colorFor(label, STEWARD_PALETTE) }}>
                {initialOf(label)}
              </span>
            );
          })}
          {(!fw.stewards || fw.stewards.length === 0) && (
            <span
              className="ai-gov-fw-steward-avatar"
              style={{ background: 'var(--gray-300, #D5D7DA)' }}>
              —
            </span>
          )}
        </div>
        <span className="ai-gov-fw-stewards-label">
          {t('label.steward-plural')}
        </span>
        <span className="ai-gov-fw-open-controls">
          {t('label.open-controls')}
          <IcChevR />
        </span>
      </div>
    </div>
  );
};

const LibraryCard = ({
  fw,
  loading,
  onEnable,
  onOpen,
}: {
  fw: FrameworkWithCoverage;
  loading: boolean;
  onEnable: () => void;
  onOpen: () => void;
}) => {
  const { t } = useTranslation();
  const region = fw.region ?? t('label.global');
  const sourceMeta = SOURCE_PILL[fw.source ?? 'BuiltIn'];
  const sourceLabel = sourceMeta ? t(sourceMeta.key) : fw.source ?? '';

  return (
    <div className="ai-gov-fw-library-card">
      <div className="ai-gov-fw-library-head">
        <div className="ai-gov-fw-library-icon">
          <IcScale />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ai-gov-fw-library-name" onClick={onOpen}>
            {fw.displayName ?? fw.name}
          </div>
          <div className="ai-gov-fw-library-sub">
            {region} · {sourceLabel}
          </div>
        </div>
        {sourceMeta && (
          <span className={`ai-gov-fw-pill ${sourceMeta.cls}`}>
            {sourceLabel}
          </span>
        )}
      </div>
      <div className="ai-gov-fw-library-meta">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <IcFile />
          {t('label.count-controls', {
            count: fw.controlsTotal ?? 0,
          })}
        </span>
        {fw.reference && (
          <>
            <span className="ai-gov-fw-library-meta-dot" />
            <code>{fw.reference}</code>
          </>
        )}
      </div>
      <Button
        className="ai-gov-fw-btn-sm-primary"
        disabled={loading}
        type="button"
        onClick={onEnable}>
        <IcPlus style={{ width: 12, height: 12 }} />
        {t('label.enable-framework')}
      </Button>
    </div>
  );
};

const CustomFrameworkCard = ({ onClick }: { onClick: () => void }) => {
  const { t } = useTranslation();

  return (
    <div className="ai-gov-fw-custom-card" onClick={onClick}>
      <div className="ai-gov-fw-custom-icon">
        <IcPlus />
      </div>
      <div>
        <div className="ai-gov-fw-custom-title">
          {t('label.custom-framework')}
        </div>
        <div className="ai-gov-fw-custom-sub">
          {t('message.custom-framework-sub')}
        </div>
      </div>
      <Button className="ai-gov-fw-btn-sm-secondary" type="button">
        <IcPlus style={{ width: 12, height: 12 }} />
        {t('label.create')}
      </Button>
    </div>
  );
};

const describeAutoApply = (fw: AIGovernanceFramework): string => {
  const rules = fw.autoApply;
  if (!rules) {
    return '—';
  }
  const segments: string[] = [];
  if (rules.regions && rules.regions.length > 0) {
    segments.push(rules.regions.join(', '));
  }
  if (rules.riskClasses && rules.riskClasses.length > 0) {
    segments.push(rules.riskClasses.join(' / ') + ' risk');
  }
  if (rules.deploymentStages && rules.deploymentStages.length > 0) {
    segments.push(rules.deploymentStages.join(' / '));
  }
  if (segments.length === 0) {
    return 'All AI assets';
  }

  return segments.join(' · ');
};

const CADENCE_OPTIONS: { id: AssessmentCadence; key: string }[] = [
  { id: 'Monthly', key: 'label.monthly' },
  { id: 'Quarterly', key: 'label.quarterly' },
  { id: 'SemiAnnual', key: 'label.semi-annual' },
  { id: 'Annual', key: 'label.annual' },
];

type ControlsSource = 'manual' | 'import' | 'fork';

const CreateFrameworkModal = ({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [region, setRegion] = useState('');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [cadence, setCadence] = useState<AssessmentCadence>('Quarterly');
  const [source, setSource] = useState<ControlsSource>('import');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setName('');
      setDisplayName('');
      setRegion('');
      setReference('');
      setDescription('');
      setCadence('Quarterly');
      setSource('import');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      showErrorToast(t('message.framework-name-required'));

      return;
    }
    setSubmitting(true);
    try {
      await createFramework({
        name: name.trim(),
        displayName: displayName.trim() || undefined,
        description: description.trim() || undefined,
        reference: reference.trim() || undefined,
        region: region.trim() || undefined,
        source: 'Custom',
        assessmentCadence: cadence,
        enabled: false,
      });
      showSuccessToast(t('message.framework-created'));
      onCreated();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      centered
      className="ai-gov-fw-modal"
      closable={false}
      footer={null}
      maskClosable={!submitting}
      open={open}
      width={720}
      onCancel={onClose}>
      <div className="ai-gov-fw-modal-head">
        <div className="ai-gov-fw-modal-icon">
          <IcScale />
        </div>
        <div style={{ flex: 1 }}>
          <div className="ai-gov-fw-modal-title">
            {t('label.create-custom-framework')}
          </div>
          <div className="ai-gov-fw-modal-sub">
            {t('message.custom-framework-modal-sub')}
          </div>
        </div>
        <Button
          className="ai-gov-fw-btn-tertiary"
          style={{ width: 32, padding: 0 }}
          type="button"
          onClick={onClose}>
          <IcX />
        </Button>
      </div>

      <div className="ai-gov-fw-modal-body">
        <div className="ai-gov-fw-form-field">
          <div className="ai-gov-fw-form-label">
            {t('label.framework-name')}
            <span className="ai-gov-fw-form-required">*</span>
          </div>
          <Input
            placeholder="e.g. internal_aup_v2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="ai-gov-fw-form-grid">
          <div className="ai-gov-fw-form-field">
            <div className="ai-gov-fw-form-label">
              {t('label.display-name')}
            </div>
            <Input
              placeholder="e.g. Internal AI Acceptable Use Policy v2"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="ai-gov-fw-form-field">
            <div className="ai-gov-fw-form-label">{t('label.reference')}</div>
            <Input
              placeholder="e.g. AUP-v2.0"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
        </div>

        <div className="ai-gov-fw-form-grid">
          <div className="ai-gov-fw-form-field">
            <div className="ai-gov-fw-form-label">
              {t('label.region-jurisdiction')}
            </div>
            <Input
              placeholder="e.g. Internal · all regions"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
          </div>
          <div className="ai-gov-fw-form-field">
            <div className="ai-gov-fw-form-label">
              {t('label.assessment-cadence')}
            </div>
            <div className="ai-gov-fw-cadence">
              {CADENCE_OPTIONS.map((opt) => (
                <Button
                  className={`ai-gov-fw-cadence-item ${
                    cadence === opt.id ? 'is-active' : ''
                  }`}
                  key={opt.id}
                  type="button"
                  onClick={() => setCadence(opt.id)}>
                  {t(opt.key)}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="ai-gov-fw-form-field">
          <div className="ai-gov-fw-form-label">
            {t('label.description')}
            <span className="ai-gov-fw-form-sub">
              · {t('message.framework-description-hint')}
            </span>
          </div>
          <Input.TextArea
            placeholder="Internal acceptable-use policy covering generative AI in customer-facing applications."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="ai-gov-fw-form-field">
          <div className="ai-gov-fw-form-label">
            {t('label.controls-source')}
            <span className="ai-gov-fw-form-sub">
              · {t('message.controls-source-hint')}
            </span>
          </div>
          <div className="ai-gov-fw-source-tiles">
            <SourceTile
              icon={<IcPlus />}
              selected={source === 'manual'}
              sub={t('message.controls-source-manual-sub')}
              title={t('label.controls-source-manual')}
              onSelect={() => setSource('manual')}
            />
            <SourceTile
              icon={<IcDownload />}
              selected={source === 'import'}
              sub={t('message.controls-source-import-sub')}
              title={t('label.controls-source-import')}
              onSelect={() => setSource('import')}
            />
            <SourceTile
              icon={<IcCopy />}
              selected={source === 'fork'}
              sub={t('message.controls-source-fork-sub')}
              title={t('label.controls-source-fork')}
              onSelect={() => setSource('fork')}
            />
          </div>
        </div>

        <div className="ai-gov-fw-form-field">
          <div className="ai-gov-fw-form-label">
            {t('label.auto-apply-rules')}
            <span className="ai-gov-fw-form-sub">
              · {t('message.auto-apply-rules-hint')}
            </span>
          </div>
          <div className="ai-gov-fw-rules">
            <RuleRow
              label={t('label.asset-type-plural')}
              value="AI Applications, AI Agents"
            />
            <RuleRow label={t('label.region-plural')} value={t('label.any')} />
            <RuleRow label={t('label.risk-class')} value="High, Limited" />
            <RuleRow
              label={t('label.deployment')}
              value="Production, Staging"
            />
          </div>
        </div>
      </div>

      <div className="ai-gov-fw-modal-foot">
        <Button
          className="ai-gov-fw-btn-tertiary"
          type="button"
          onClick={onClose}>
          {t('label.cancel')}
        </Button>
        <div className="ai-gov-fw-spacer" />
        <Button className="ai-gov-fw-btn-secondary" type="button">
          {t('label.save-as-draft')}
        </Button>
        <Button
          className="ai-gov-fw-btn-primary"
          disabled={submitting}
          type="button"
          onClick={handleSubmit}>
          <IcCheck style={{ width: 14, height: 14 }} />
          {t('label.create-and-enable')}
        </Button>
      </div>
    </Modal>
  );
};

const SourceTile = ({
  icon,
  title,
  sub,
  selected,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  selected: boolean;
  onSelect: () => void;
}) => (
  <div
    className={`ai-gov-fw-source-tile ${selected ? 'is-selected' : ''}`}
    onClick={onSelect}>
    <div className="ai-gov-fw-source-icon">{icon}</div>
    <div className="ai-gov-fw-source-title">{title}</div>
    <div className="ai-gov-fw-source-sub">{sub}</div>
  </div>
);

const RuleRow = ({ label, value }: { label: string; value: string }) => {
  const { t } = useTranslation();

  return (
    <div className="ai-gov-fw-rule-row">
      <span className="ai-gov-fw-rule-label">{label}</span>
      <span className="ai-gov-fw-rule-value">{value}</span>
      <Button className="ai-gov-fw-btn-tertiary" type="button">
        {t('label.edit')}
      </Button>
    </div>
  );
};

export default FrameworksSection;
