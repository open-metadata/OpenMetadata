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
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getPolicyStatus, PolicyRule } from '../../../rest/aiGovernanceAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import type { ColumnsType } from '../components/AIGovUntitled.component';
import {
  Card,
  Empty,
  Skeleton,
  Table,
  Typography,
} from '../components/AIGovUntitled.component';
import '../styles/ai-gov-pills.less';
import { AIAssetView } from './AssetDetail.types';

interface PoliciesTabProps {
  view: AIAssetView;
}

const STATUS_PILL: Record<PolicyRule['status'], string> = {
  Passing: 'ai-gov-pill--success',
  Breached: 'ai-gov-pill--error',
  NotApplicable: 'ai-gov-pill--quiet',
};

const STATUS_LABEL: Record<PolicyRule['status'], string> = {
  Passing: 'Passing',
  Breached: 'Breached',
  NotApplicable: 'N/A',
};

const PoliciesTab = ({ view }: PoliciesTabProps) => {
  const { t } = useTranslation();
  const [rules, setRules] = useState<PolicyRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const response = await getPolicyStatus(view.entityType, view.id);
        if (!cancelled) {
          setRules(response.rules);
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
  }, [view.entityType, view.id]);

  const columns: ColumnsType<PolicyRule> = [
    {
      title: t('label.policy'),
      key: 'name',
      render: (_, rule) => (
        <div>
          <Typography.Text strong>{rule.name}</Typography.Text>
          <Typography.Paragraph className="tw:mb-0" type="secondary">
            {rule.description}
          </Typography.Paragraph>
        </div>
      ),
    },
    {
      title: t('label.value'),
      dataIndex: 'value',
      render: (value) => (
        <Typography.Text className="tw:font-mono">
          {String(value ?? '—')}
        </Typography.Text>
      ),
    },
    {
      title: t('label.status'),
      dataIndex: 'status',
      width: 140,
      render: (status) => {
        const policyStatus = status as PolicyRule['status'];

        return (
          <span className={`ai-gov-pill ${STATUS_PILL[policyStatus]}`}>
            {policyStatus !== 'NotApplicable' && (
              <span className="ai-gov-pill-dot" />
            )}
            {STATUS_LABEL[policyStatus]}
          </span>
        );
      },
    },
  ];

  if (loading) {
    return <Skeleton active paragraph={{ rows: 5 }} />;
  }

  if (rules.length === 0) {
    return (
      <Card>
        <Empty
          description={t('label.no-entity', {
            entity: t('label.policy-plural'),
          })}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    );
  }

  return (
    <Card title={t('label.policy-plural')}>
      <Table<PolicyRule>
        columns={columns}
        dataSource={rules}
        pagination={false}
        rowKey="name"
      />
    </Card>
  );
};

export default PoliciesTab;
