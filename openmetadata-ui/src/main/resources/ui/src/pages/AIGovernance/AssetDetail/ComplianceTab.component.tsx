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

import { ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/AIGovUntitled.component';
import {
  IcCal,
  IcCheck,
  IcCheckCirc,
  IcDownload,
  IcExternal,
  IcEye,
  IcLeaf,
  IcLock,
  IcScale,
  IcShield,
  IcShieldTick,
  IcUser,
  IcUsers,
  IcX,
} from '../icons/AIGovIcons';
import {
  RegistryFramework,
  RegistryFrameworkStatus,
  RegistryRiskClassification,
} from '../sections/Registry/Registry.types';
import { AIAssetView, ComplianceRecordView } from './AssetDetail.types';
import './compliance-tab.less';

interface ComplianceTabProps {
  view: AIAssetView;
}

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

const STATUS_TONE: Record<
  RegistryFrameworkStatus,
  'success' | 'warning' | 'error' | 'info'
> = {
  Compliant: 'success',
  PartiallyCompliant: 'warning',
  NonCompliant: 'error',
  UnderReview: 'info',
  NotApplicable: 'info',
};

const STATUS_PILL_CLS: Record<RegistryFrameworkStatus, string> = {
  Compliant: 'ai-gov-pill--success',
  PartiallyCompliant: 'ai-gov-pill--warning',
  NonCompliant: 'ai-gov-pill--error',
  UnderReview: 'ai-gov-pill--info',
  NotApplicable: 'ai-gov-pill--quiet',
};

const STATUS_LABEL: Record<RegistryFrameworkStatus, string> = {
  Compliant: 'Compliant',
  PartiallyCompliant: 'Partially compliant',
  NonCompliant: 'Non-compliant',
  UnderReview: 'Under review',
  NotApplicable: 'Not applicable',
};

const RISK_ORDER: RegistryRiskClassification[] = [
  'Unacceptable',
  'High',
  'Limited',
  'Minimal',
];

const RISK_SUBTITLE: Record<RegistryRiskClassification, string> = {
  Unacceptable: 'Prohibited under Art 5',
  High: 'Annex III categories',
  Limited: 'Transparency obligations',
  Minimal: 'Voluntary best practices',
};

const ARTICLE_5_PRACTICES: Array<{ key: string; label: string; ref: string }> =
  [
    {
      key: 'subliminalManipulativeTechniques',
      label: 'Subliminal manipulative techniques',
      ref: 'Art 5(1)(a)',
    },
    {
      key: 'exploitationOfVulnerabilities',
      label: 'Exploitation of vulnerabilities',
      ref: 'Art 5(1)(b)',
    },
    {
      key: 'socialScoringSystem',
      label: 'Social scoring by public authorities',
      ref: 'Art 5(1)(c)',
    },
    {
      key: 'riskAssessmentCriminalOffences',
      label: 'Risk assessment from profiling alone',
      ref: 'Art 5(1)(d)',
    },
    {
      key: 'facialRecognitionDatabaseCreation',
      label: 'Untargeted facial-image scraping',
      ref: 'Art 5(1)(e)',
    },
    {
      key: 'emotionInferenceWorkplaceEducation',
      label: 'Emotion recognition (workplace/education)',
      ref: 'Art 5(1)(f)',
    },
    {
      key: 'biometricCategorisation',
      label: 'Biometric inference of sensitive attributes',
      ref: 'Art 5(1)(g)',
    },
    {
      key: 'realTimeBiometricIdentification',
      label: 'Real-time biometric ID in public spaces',
      ref: 'Art 5(1)(h)',
    },
  ];

const ARTICLE_6_CATEGORIES: Array<{ key: string; label: string; ref: string }> =
  [
    {
      key: 'criticalInfrastructure',
      label: 'Critical infrastructure',
      ref: 'Annex III(1)',
    },
    {
      key: 'educationVocationalTraining',
      label: 'Education & vocational training',
      ref: 'Annex III(3)',
    },
    {
      key: 'employment',
      label: 'Employment & worker management',
      ref: 'Annex III(4)',
    },
    {
      key: 'essentialPrivateServices',
      label: 'Essential private services',
      ref: 'Annex III(5)',
    },
    {
      key: 'essentialPublicServices',
      label: 'Essential public services',
      ref: 'Annex III(6)',
    },
    { key: 'lawEnforcement', label: 'Law enforcement', ref: 'Annex III(6)' },
    {
      key: 'migrationAsylumBorderControl',
      label: 'Migration, asylum, borders',
      ref: 'Annex III(7)',
    },
    {
      key: 'administrationOfJustice',
      label: 'Justice & democratic processes',
      ref: 'Annex III(8)',
    },
  ];

type EthicalTone = 'good' | 'warn' | 'bad' | 'neutral';

const ETHICAL_TONE: Record<string, EthicalTone> = {
  Public: 'good',
  Sensitive: 'warn',
  PersonalData: 'bad',
  Low: 'good',
  Medium: 'warn',
  High: 'bad',
  Moderate: 'warn',
  None: 'good',
  Partial: 'warn',
  Full: 'good',
  FullDisclosure: 'good',
  LowRisk: 'good',
  MediumRisk: 'warn',
  HighRisk: 'bad',
};

const ETHICAL_AXES: Array<{
  key: keyof NonNullable<ComplianceRecordView['ethicalAssessment']>;
  label: string;
  icon: ReactNode;
}> = [
  { key: 'privacyLevel', label: 'Privacy', icon: <IcLock /> },
  { key: 'fairnessRisk', label: 'Fairness & bias', icon: <IcScale /> },
  {
    key: 'reliabilitySafetyRisk',
    label: 'Reliability & safety',
    icon: <IcShield />,
  },
  { key: 'transparencyLevel', label: 'Transparency', icon: <IcEye /> },
  { key: 'biasMitigationCoverage', label: 'Accountability', icon: <IcUsers /> },
  {
    key: 'environmentalConsciousness',
    label: 'Environmental impact',
    icon: <IcLeaf />,
  },
];

const formatDate = (value?: number): string =>
  typeof value === 'number' ? new Date(value).toLocaleDateString() : '—';

const ComplianceTab = ({ view }: ComplianceTabProps) => {
  const { t } = useTranslation();

  const availableFrameworks = useMemo<RegistryFramework[]>(() => {
    const set = new Set<RegistryFramework>();
    view.frameworkSummaries.forEach((s) => set.add(s.framework));

    return Array.from(set);
  }, [view.frameworkSummaries]);

  const [selectedFramework, setSelectedFramework] = useState<RegistryFramework>(
    availableFrameworks.includes(RegistryFramework.EU_AI_ACT)
      ? RegistryFramework.EU_AI_ACT
      : availableFrameworks[0] ?? RegistryFramework.EU_AI_ACT
  );

  if (availableFrameworks.length === 0) {
    return (
      <div className="ai-gov-comp-empty">
        <IcScale className="ai-gov-comp-empty-icon" />
        <div className="ai-gov-comp-empty-text">
          {t('label.no-entity', { entity: t('label.compliance') })}
        </div>
      </div>
    );
  }

  const record = view.complianceRecords.find(
    (r) => r.framework === selectedFramework
  );
  const summary = view.frameworkSummaries.find(
    (s) => s.framework === selectedFramework
  );

  return (
    <div className="ai-gov-comp">
      <FrameworkSwitcher
        frameworks={availableFrameworks}
        selected={selectedFramework}
        statuses={view.frameworkSummaries}
        onSelect={setSelectedFramework}
      />

      <StatusBand
        assessedBy={summary?.assessedBy}
        framework={selectedFramework}
        nextReviewDate={summary?.nextReviewDate}
        riskClassification={view.riskClassification}
        status={summary?.status}
      />

      {selectedFramework === RegistryFramework.EU_AI_ACT && (
        <>
          <RiskClassificationGrid
            rationale={view.riskRationale}
            riskClassification={view.riskClassification}
          />

          <div className="ai-gov-comp-split">
            <ChecklistCard
              inverted
              items={ARTICLE_5_PRACTICES.map((p) => ({
                key: p.key,
                label: p.label,
                ref: p.ref,
                triggered: Boolean(
                  record?.euAIAct?.prohibitedPractices?.[p.key]
                ),
              }))}
              subtitle={t('message.article-5-subtitle')}
              title={t('label.article-5-prohibited-practices')}
            />
            <ChecklistCard
              items={ARTICLE_6_CATEGORIES.map((c) => ({
                key: c.key,
                label: c.label,
                ref: c.ref,
                triggered: Boolean(record?.euAIAct?.highRiskSystems?.[c.key]),
              }))}
              subtitle={t('message.article-6-subtitle')}
              title={t('label.article-6-high-risk-categories')}
            />
          </div>

          <div className="ai-gov-comp-conformity-split">
            <ConformityCard record={record} />
            <TransparencyCard record={record} />
          </div>
        </>
      )}

      <EthicalAssessmentCard record={record} />

      {Boolean(record?.remediationRequired?.length) && (
        <RemediationCard items={record?.remediationRequired ?? []} />
      )}
    </div>
  );
};

const FrameworkSwitcher = ({
  frameworks,
  statuses,
  selected,
  onSelect,
}: {
  frameworks: RegistryFramework[];
  statuses: AIAssetView['frameworkSummaries'];
  selected: RegistryFramework;
  onSelect: (f: RegistryFramework) => void;
}) => {
  const { t } = useTranslation();

  return (
    <div className="ai-gov-comp-switcher">
      <div className="ai-gov-comp-switcher-label">{t('label.framework')}</div>
      {frameworks.map((fw) => {
        const summary = statuses.find((s) => s.framework === fw);
        const tone = summary?.status ? STATUS_TONE[summary.status] : 'info';

        return (
          <Button
            className={`ai-gov-comp-fw-btn ${
              selected === fw ? 'is-active' : ''
            } is-status-${tone}`}
            key={fw}
            type="button"
            onClick={() => onSelect(fw)}>
            <IcScale />
            {FRAMEWORK_LABELS[fw]}
            <span className="ai-gov-comp-fw-dot" />
          </Button>
        );
      })}
      <div className="ai-gov-comp-spacer" />
      <Button className="ai-gov-comp-fw-btn" type="button">
        <IcDownload />
        {t('label.export-evidence')}
      </Button>
    </div>
  );
};

const StatusBand = ({
  framework,
  status,
  riskClassification,
  assessedBy,
  nextReviewDate,
}: {
  framework: RegistryFramework;
  status?: RegistryFrameworkStatus;
  riskClassification?: RegistryRiskClassification;
  assessedBy?: string;
  nextReviewDate?: number;
}) => {
  const { t } = useTranslation();
  const tone = status ? STATUS_TONE[status] : 'info';
  const details =
    riskClassification === 'High' || riskClassification === 'Unacceptable'
      ? 'Annex III applicable · conformity assessment required · review gaps before audit'
      : riskClassification === 'Limited'
      ? 'Limited-risk classification · transparency obligations under Article 50'
      : riskClassification === 'Minimal'
      ? 'Minimal-risk classification · voluntary best practices apply'
      : 'Risk classification pending';

  return (
    <div className={`ai-gov-comp-band is-${tone}`}>
      <div className="ai-gov-comp-band-icon">
        <IcShieldTick />
      </div>
      <div style={{ flex: 1 }}>
        <div className="ai-gov-comp-band-title">
          {FRAMEWORK_LABELS[framework]}
          {status && (
            <span className={`ai-gov-pill ${STATUS_PILL_CLS[status]}`}>
              <span className="ai-gov-pill-dot" />
              {STATUS_LABEL[status]}
            </span>
          )}
        </div>
        <div className="ai-gov-comp-band-detail">{details}</div>
      </div>
      <div className="ai-gov-comp-band-meta">
        {nextReviewDate && (
          <div>
            <IcCal />
            {t('label.next-review')} ·{' '}
            <b>{new Date(nextReviewDate).toLocaleDateString()}</b>
          </div>
        )}
        {assessedBy && (
          <div>
            <IcUser />
            {t('label.assessor')} · <b>{assessedBy}</b>
          </div>
        )}
      </div>
    </div>
  );
};

const RiskClassificationGrid = ({
  riskClassification,
  rationale,
}: {
  riskClassification?: RegistryRiskClassification;
  rationale?: string;
}) => {
  const { t } = useTranslation();

  return (
    <div className="ai-gov-comp-card">
      <div className="ai-gov-comp-card-head">
        <div>
          <div className="ai-gov-comp-card-title">
            {t('label.risk-classification')}
          </div>
          <div className="ai-gov-comp-card-sub">
            {t('message.risk-classification-derived')}
          </div>
        </div>
      </div>
      <div className="ai-gov-comp-risk-grid">
        {RISK_ORDER.map((risk) => {
          const isSelected = riskClassification === risk;

          return (
            <div
              className={`ai-gov-comp-risk-tile ${
                isSelected ? `is-selected-${risk.toLowerCase()}` : ''
              }`}
              key={risk}>
              {isSelected && (
                <div className="ai-gov-comp-risk-check">
                  <IcCheckCirc />
                </div>
              )}
              <div className="ai-gov-comp-risk-head">
                <span className="ai-gov-comp-risk-dot" />
                <span className="ai-gov-comp-risk-name">{risk}</span>
              </div>
              <div className="ai-gov-comp-risk-sub">{RISK_SUBTITLE[risk]}</div>
            </div>
          );
        })}
      </div>
      {rationale && (
        <div className="ai-gov-comp-rationale">
          <b>{t('label.rationale')}.</b> {rationale}
        </div>
      )}
    </div>
  );
};

const ChecklistCard = ({
  title,
  subtitle,
  items,
  inverted,
}: {
  title: string;
  subtitle: string;
  items: Array<{ key: string; label: string; ref: string; triggered: boolean }>;
  inverted?: boolean;
}) => {
  return (
    <div className="ai-gov-comp-card">
      <div className="ai-gov-comp-card-head">
        <div>
          <div className="ai-gov-comp-card-title">{title}</div>
          <div className="ai-gov-comp-card-sub">{subtitle}</div>
        </div>
      </div>
      <div className="ai-gov-comp-checklist">
        {items.map((item) => {
          // For inverted (Art 5): pass = !triggered (good), fail = triggered
          // For Art 6: triggered = applies (highlights warning)
          const isPass = inverted ? !item.triggered : item.triggered;
          const cls = inverted
            ? item.triggered
              ? 'is-fail'
              : 'is-pass'
            : item.triggered
            ? 'is-fail'
            : 'is-neutral';

          return (
            <div className={`ai-gov-comp-checklist-row ${cls}`} key={item.key}>
              <span className="ai-gov-comp-checklist-icon">
                {isPass ? <IcCheck /> : <IcX />}
              </span>
              <span className="ai-gov-comp-checklist-label">{item.label}</span>
              <span className="ai-gov-comp-checklist-ref">{item.ref}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ConformityCard = ({ record }: { record?: ComplianceRecordView }) => {
  const { t } = useTranslation();
  const conformity = record?.euAIAct?.conformityAssessment;
  const verification = record?.verification;

  return (
    <div className="ai-gov-comp-card">
      <div className="ai-gov-comp-card-head">
        <div>
          <div className="ai-gov-comp-card-title">
            {t('label.conformity-assessment')}
          </div>
          <div className="ai-gov-comp-card-sub">
            {t('message.conformity-assessment-sub')}
          </div>
        </div>
      </div>
      <div className="ai-gov-comp-field-grid">
        <Field
          label={t('label.assessment-required')}
          value={
            conformity?.assessmentRequired == null
              ? '—'
              : conformity.assessmentRequired
              ? t('label.yes')
              : t('label.no')
          }
        />
        <Field
          label={t('label.assessment-type')}
          value={conformity?.assessmentType ?? '—'}
        />
        <Field
          label={t('label.assessment-body')}
          value={conformity?.assessmentBody ?? '—'}
        />
        <Field
          mono
          label={t('label.certificate')}
          value={conformity?.certificateNumber ?? '—'}
        />
        <Field
          label={t('label.valid-until')}
          value={formatDate(conformity?.validUntil)}
        />
        <Field
          label={t('label.documentation')}
          value={
            verification?.certificateUrl ? (
              <a
                href={verification.certificateUrl}
                rel="noreferrer"
                target="_blank">
                technical-docs.pdf{' '}
                <IcExternal style={{ width: 11, height: 11 }} />
              </a>
            ) : (
              '—'
            )
          }
        />
      </div>
    </div>
  );
};

const TransparencyCard = ({ record }: { record?: ComplianceRecordView }) => {
  const { t } = useTranslation();
  const transparency = record?.euAIAct?.transparencyObligations;

  return (
    <div className="ai-gov-comp-card">
      <div className="ai-gov-comp-card-head">
        <div>
          <div className="ai-gov-comp-card-title">
            {t('label.transparency-obligations')}
          </div>
          <div className="ai-gov-comp-card-sub">
            {t('message.transparency-obligations-sub')}
          </div>
        </div>
      </div>
      <div className="ai-gov-comp-checklist">
        <TransparencyRow
          label={t('label.users-informed')}
          ok={transparency?.usersInformed}
        />
        <TransparencyRow
          label={t('label.content-labeled')}
          ok={transparency?.deepfakeLabeling}
        />
        <TransparencyRow
          optional
          label={t('label.biometric-disclosed')}
          ok={transparency?.emotionRecognitionDisclosure}
        />
      </div>
    </div>
  );
};

const TransparencyRow = ({
  ok,
  label,
  optional,
}: {
  ok?: boolean;
  label: string;
  optional?: boolean;
}) => {
  const cls = ok === true ? 'is-pass' : ok === false ? 'is-fail' : 'is-neutral';

  return (
    <div className={`ai-gov-comp-checklist-row ${cls}`}>
      <span className="ai-gov-comp-checklist-icon">
        {ok ? <IcCheck /> : <IcX />}
      </span>
      <span className="ai-gov-comp-checklist-label">
        {label}
        {optional && (
          <span className="ai-gov-comp-checklist-ref" style={{ marginLeft: 6 }}>
            (optional)
          </span>
        )}
      </span>
    </div>
  );
};

const Field = ({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) => (
  <div>
    <div className="ai-gov-comp-field-label">{label}</div>
    <div
      className={`ai-gov-comp-field-value ${mono ? 'is-mono' : ''} ${
        value === '—' ? 'is-muted' : ''
      }`}>
      {value}
    </div>
  </div>
);

const EthicalAssessmentCard = ({
  record,
}: {
  record?: ComplianceRecordView;
}) => {
  const { t } = useTranslation();
  const ethical = record?.ethicalAssessment;

  return (
    <div className="ai-gov-comp-card">
      <div className="ai-gov-comp-card-head">
        <div>
          <div className="ai-gov-comp-card-title">
            {t('label.ethical-ai-assessment')}
          </div>
          <div className="ai-gov-comp-card-sub">
            {t('message.ethical-ai-assessment-sub')}
          </div>
        </div>
      </div>
      <div className="ai-gov-comp-ethical-grid">
        {ETHICAL_AXES.map((axis) => {
          const rawValue = ethical?.[axis.key] as string | undefined;
          const tone: EthicalTone = rawValue
            ? ETHICAL_TONE[rawValue] ?? 'neutral'
            : 'neutral';

          return (
            <div
              className={`ai-gov-comp-ethical-card is-${tone}`}
              key={axis.key}>
              <div className="ai-gov-comp-ethical-icon">{axis.icon}</div>
              <div className="ai-gov-comp-ethical-label">{axis.label}</div>
              <div className="ai-gov-comp-ethical-value">{rawValue ?? '—'}</div>
              <div className="ai-gov-comp-ethical-bar">
                <div className="ai-gov-comp-ethical-fill" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const RemediationCard = ({ items }: { items: string[] }) => {
  const { t } = useTranslation();

  return (
    <div className="ai-gov-comp-card">
      <div className="ai-gov-comp-card-head">
        <div>
          <div className="ai-gov-comp-card-title">{t('label.remediation')}</div>
          <div className="ai-gov-comp-card-sub">
            {t('label.count-actions-required', { count: items.length })}
          </div>
        </div>
      </div>
      <div className="ai-gov-comp-remediation">
        {items.map((item, idx) => (
          <div className="ai-gov-comp-remediation-row is-medium" key={idx}>
            <span className="ai-gov-comp-remediation-dot" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ai-gov-comp-remediation-label">{item}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComplianceTab;
