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
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AIApplication,
  ApplicationType,
  DevelopmentStage,
} from '../../../generated/entity/ai/aiApplication';
import { createAIApplication } from '../../../rest/aiApplicationAPI';
import { submitForReview } from '../../../rest/aiGovernanceAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import {
  Button,
  Checkbox,
  Col,
  Input,
  Modal,
  Radio,
  Row,
  Select,
  Space,
  Steps,
  Tag,
  Typography,
} from '../components/AIGovUntitled.component';

const REGIONS = ['EU', 'US', 'UK', 'APAC', 'CA', 'LATAM', 'MENA'];

const DATA_CATEGORY_OPTIONS = [
  'Customer profile',
  'Support transcripts',
  'Payment history',
  'Resume content',
  'Performance ratings',
  'Telemetry',
  'Slack messages',
  'Marketing leads',
];

const ARTICLE_6_KEYS: Array<{ key: string; label: string }> = [
  {
    key: 'criticalInfrastructure',
    label: 'Critical infrastructure (Annex III(1))',
  },
  {
    key: 'educationVocationalTraining',
    label: 'Education & vocational training (Annex III(3))',
  },
  { key: 'employment', label: 'Employment & worker management (Annex III(4))' },
  {
    key: 'essentialPrivateServices',
    label: 'Essential private services (Annex III(5))',
  },
  {
    key: 'essentialPublicServices',
    label: 'Essential public services (Annex III(6))',
  },
  { key: 'lawEnforcement', label: 'Law enforcement (Annex III(6))' },
  {
    key: 'migrationAsylumBorderControl',
    label: 'Migration, asylum, borders (Annex III(7))',
  },
  {
    key: 'administrationOfJustice',
    label: 'Justice & democratic processes (Annex III(8))',
  },
];

const ARTICLE_5_KEYS: Array<{ key: string; label: string }> = [
  {
    key: 'subliminalManipulativeTechniques',
    label: 'Subliminal manipulative techniques',
  },
  {
    key: 'exploitationOfVulnerabilities',
    label: 'Exploitation of vulnerabilities',
  },
  { key: 'socialScoringSystem', label: 'Social scoring by public authorities' },
  {
    key: 'riskAssessmentCriminalOffences',
    label: 'Risk assessment solely from profiling',
  },
  {
    key: 'facialRecognitionDatabaseCreation',
    label: 'Untargeted facial-image scraping',
  },
  {
    key: 'emotionInferenceWorkplaceEducation',
    label: 'Emotion recognition (workplace/education)',
  },
  {
    key: 'biometricCategorisation',
    label: 'Biometric inference of sensitive attributes',
  },
  {
    key: 'realTimeBiometricIdentification',
    label: 'Real-time biometric ID in public spaces',
  },
];

const RISK_TIERS = ['Minimal', 'Limited', 'High', 'Unacceptable'] as const;

type RiskTier = (typeof RISK_TIERS)[number];

interface WizardFormState {
  name: string;
  applicationType: ApplicationType;
  description: string;
  domain: string;
  deployment: DevelopmentStage;
  regions: string[];
  accessesPii: boolean;
  accessesSensitive: boolean;
  dataCategories: string[];
  art6: Record<string, boolean>;
  art5: Record<string, boolean>;
  riskClassification: RiskTier;
  notes: string;
}

const initialState = (): WizardFormState => ({
  name: '',
  applicationType: ApplicationType.Chatbot,
  description: '',
  domain: '',
  deployment: DevelopmentStage.Development,
  regions: ['EU'],
  accessesPii: false,
  accessesSensitive: false,
  dataCategories: [],
  art6: {},
  art5: {},
  riskClassification: 'Limited',
  notes: '',
});

interface IntakeWizardProps {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

const IntakeWizard = ({ open, onClose, onSubmitted }: IntakeWizardProps) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardFormState>(initialState());
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setStep(0);
    setForm(initialState());
  };

  const handleClose = () => {
    if (submitting) {
      return;
    }
    reset();
    onClose();
  };

  const update = <K extends keyof WizardFormState>(
    key: K,
    value: WizardFormState[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleBoolMap = (
    key: 'art5' | 'art6' | 'dataCategories' | 'regions',
    item: string
  ) => {
    if (key === 'art5' || key === 'art6') {
      setForm((prev) => ({
        ...prev,
        [key]: { ...prev[key], [item]: !prev[key][item] },
      }));
    } else {
      setForm((prev) => {
        const existing = prev[key] as string[];
        const next = existing.includes(item)
          ? existing.filter((v) => v !== item)
          : [...existing, item];

        return { ...prev, [key]: next };
      });
    }
  };

  const buildCreatePayload = () => ({
    name: form.name,
    description: form.description,
    applicationType: form.applicationType,
    developmentStage: form.deployment,
    modelConfigurations: [],
    governanceMetadata: {
      registrationStatus: 'PendingApproval',
      dataClassification: {
        accessesPII: form.accessesPii,
        accessesSensitiveData: form.accessesSensitive,
        dataCategories: form.dataCategories,
      },
      aiCompliance: {
        complianceRecords: [
          {
            framework: 'EU_AI_Act',
            status: 'UnderReview',
            euAIAct: {
              riskClassification: form.riskClassification,
              prohibitedPractices: form.art5,
              highRiskSystems: form.art6,
            },
            scopeAndDeployment: {
              deploymentRegions: form.regions,
            },
          },
        ],
      },
      intakeNotes: form.notes,
    },
  });

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const created = await createAIApplication(
        buildCreatePayload() as Partial<AIApplication>
      );
      if (created.id) {
        await submitForReview('aiApplication', created.id);
      }
      showSuccessToast(
        t('message.entity-submitted-for-review', {
          entity: t('label.ai-application-plural'),
        })
      );
      onSubmitted?.();
      reset();
      onClose();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      destroyOnClose
      cancelText={t('label.cancel')}
      footer={
        <Space>
          <Button onClick={handleClose}>{t('label.cancel')}</Button>
          {step > 0 && (
            <Button disabled={submitting} onClick={() => setStep(step - 1)}>
              {t('label.back')}
            </Button>
          )}
          {step < 3 ? (
            <Button
              disabled={!isStepValid(form, step)}
              type="primary"
              onClick={() => setStep(step + 1)}>
              {t('label.continue')}
            </Button>
          ) : (
            <Button loading={submitting} type="primary" onClick={handleSubmit}>
              {t('label.submit-for-review')}
            </Button>
          )}
        </Space>
      }
      open={open}
      title={t('label.register-ai-asset')}
      width={780}
      onCancel={handleClose}>
      <Steps
        className="tw:mb-4"
        current={step}
        items={[
          { title: t('label.identify') },
          { title: t('label.data-and-deployment') },
          { title: t('label.risk-classification') },
          { title: t('label.submit-for-review') },
        ]}
        size="small"
      />

      {step === 0 && <Step0Identify form={form} update={update} />}
      {step === 1 && (
        <Step1DataDeployment
          form={form}
          toggleBoolMap={toggleBoolMap}
          update={update}
        />
      )}
      {step === 2 && (
        <Step2RiskClassification
          form={form}
          toggleBoolMap={toggleBoolMap}
          update={update}
        />
      )}
      {step === 3 && <Step3Submit form={form} update={update} />}
    </Modal>
  );
};

const isStepValid = (form: WizardFormState, step: number): boolean => {
  let valid = true;
  if (step === 0) {
    valid = form.name.trim().length > 0 && form.description.trim().length > 0;
  } else if (step === 1) {
    valid = form.regions.length > 0;
  }

  return valid;
};

const Step0Identify = ({
  form,
  update,
}: {
  form: WizardFormState;
  update: <K extends keyof WizardFormState>(
    key: K,
    value: WizardFormState[K]
  ) => void;
}) => {
  const { t } = useTranslation();

  return (
    <Space className="tw:w-full" direction="vertical" size="middle">
      <div>
        <Typography.Text strong>{t('label.asset-name')}</Typography.Text>
        <Input
          placeholder="e.g. Churn Risk Copilot"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
        />
      </div>
      <div>
        <Typography.Text strong>{t('label.type')}</Typography.Text>
        <Select
          className="tw:w-full"
          options={Object.values(ApplicationType).map((value) => ({
            value,
            label: value,
          }))}
          value={form.applicationType}
          onChange={(value) => update('applicationType', value)}
        />
      </div>
      <div>
        <Typography.Text strong>{t('label.description')}</Typography.Text>
        <Input.TextArea
          placeholder="Predicts customer churn and drafts retention outreach from CRM and ticket data."
          rows={3}
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
        />
      </div>
      <div>
        <Typography.Text strong>{t('label.domain')}</Typography.Text>
        <Input
          placeholder="e.g. Customer Success"
          value={form.domain}
          onChange={(e) => update('domain', e.target.value)}
        />
      </div>
    </Space>
  );
};

const Step1DataDeployment = ({
  form,
  update,
  toggleBoolMap,
}: {
  form: WizardFormState;
  update: <K extends keyof WizardFormState>(
    key: K,
    value: WizardFormState[K]
  ) => void;
  toggleBoolMap: (
    key: 'art5' | 'art6' | 'dataCategories' | 'regions',
    item: string
  ) => void;
}) => {
  const { t } = useTranslation();

  return (
    <Space className="tw:w-full" direction="vertical" size="middle">
      <div>
        <Typography.Text strong>{t('label.deployment-stage')}</Typography.Text>
        <Radio.Group
          options={Object.values(DevelopmentStage).map((value) => ({
            label: value,
            value,
          }))}
          value={form.deployment}
          onChange={(e) => update('deployment', e.target.value)}
        />
      </div>
      <div>
        <Typography.Text strong>{t('label.region-plural')}</Typography.Text>
        <div>
          {REGIONS.map((region) => (
            <Tag.CheckableTag
              checked={form.regions.includes(region)}
              key={region}
              onChange={() => toggleBoolMap('regions', region)}>
              {region}
            </Tag.CheckableTag>
          ))}
        </div>
      </div>
      <div>
        <Checkbox
          checked={form.accessesPii}
          onChange={(e) => update('accessesPii', e.target.checked)}>
          {t('label.accesses-pii')}
        </Checkbox>
        <br />
        <Checkbox
          checked={form.accessesSensitive}
          onChange={(e) => update('accessesSensitive', e.target.checked)}>
          {t('label.accesses-sensitive-data')}
        </Checkbox>
      </div>
      <div>
        <Typography.Text strong>{t('label.data-categories')}</Typography.Text>
        <div>
          {DATA_CATEGORY_OPTIONS.map((cat) => (
            <Tag.CheckableTag
              checked={form.dataCategories.includes(cat)}
              key={cat}
              onChange={() => toggleBoolMap('dataCategories', cat)}>
              {cat}
            </Tag.CheckableTag>
          ))}
        </div>
      </div>
    </Space>
  );
};

const Step2RiskClassification = ({
  form,
  update,
  toggleBoolMap,
}: {
  form: WizardFormState;
  update: <K extends keyof WizardFormState>(
    key: K,
    value: WizardFormState[K]
  ) => void;
  toggleBoolMap: (
    key: 'art5' | 'art6' | 'dataCategories' | 'regions',
    item: string
  ) => void;
}) => {
  const { t } = useTranslation();

  return (
    <Space className="tw:w-full" direction="vertical" size="middle">
      <div>
        <Typography.Text strong>
          {t('label.article-6-high-risk-categories')}
        </Typography.Text>
        <Typography.Paragraph type="secondary">
          {t('message.article-6-subtitle')}
        </Typography.Paragraph>
        {ARTICLE_6_KEYS.map((item) => (
          <Checkbox
            checked={Boolean(form.art6[item.key])}
            key={item.key}
            style={{ display: 'block', marginInlineStart: 0 }}
            onChange={() => toggleBoolMap('art6', item.key)}>
            {item.label}
          </Checkbox>
        ))}
      </div>
      <div>
        <Typography.Text strong>
          {t('label.article-5-prohibited-practices')}
        </Typography.Text>
        <Typography.Paragraph type="secondary">
          {t('message.article-5-subtitle')}
        </Typography.Paragraph>
        <Row gutter={[12, 4]}>
          {ARTICLE_5_KEYS.map((item) => (
            <Col key={item.key} md={12} xs={24}>
              <Checkbox
                checked={Boolean(form.art5[item.key])}
                onChange={() => toggleBoolMap('art5', item.key)}>
                {item.label}
              </Checkbox>
            </Col>
          ))}
        </Row>
      </div>
      <div>
        <Typography.Text strong>
          {t('label.risk-classification')}
        </Typography.Text>
        <Radio.Group
          options={RISK_TIERS.map((tier) => ({ label: tier, value: tier }))}
          value={form.riskClassification}
          onChange={(e) => update('riskClassification', e.target.value)}
        />
      </div>
    </Space>
  );
};

const Step3Submit = ({
  form,
  update,
}: {
  form: WizardFormState;
  update: <K extends keyof WizardFormState>(
    key: K,
    value: WizardFormState[K]
  ) => void;
}) => {
  const { t } = useTranslation();

  return (
    <Space className="tw:w-full" direction="vertical" size="middle">
      <Typography.Paragraph>
        <strong>{t('label.summary')}:</strong>
      </Typography.Paragraph>
      <Typography.Paragraph>
        <strong>{form.name}</strong> · {form.applicationType} ·{' '}
        {form.deployment}
      </Typography.Paragraph>
      <Typography.Paragraph>
        {t('label.region-plural')}: {form.regions.join(', ') || '—'}
      </Typography.Paragraph>
      <Typography.Paragraph>
        {t('label.risk-classification')}: <Tag>{form.riskClassification}</Tag>
      </Typography.Paragraph>
      <div>
        <Typography.Text strong>
          {t('label.notes-for-the-reviewer')}
        </Typography.Text>
        <Input.TextArea
          placeholder="Context that helps reviewers (known limitations, scope decisions, etc.)"
          rows={3}
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
        />
      </div>
    </Space>
  );
};

export default IntakeWizard;
