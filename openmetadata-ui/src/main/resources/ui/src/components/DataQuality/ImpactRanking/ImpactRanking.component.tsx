/*
 *  Copyright 2024 Collate.
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

import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import {
  Button,
  Card,
  Col,
  Empty,
  Row,
  Skeleton,
  Statistic,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { getTestCaseDetailPath } from '../../utils/RouterUtils';
import {
  DataQualityCheckImpact,
  getDataQualityCheckImpact,
} from '../../rest/testAPI';

interface ImpactRankingProps {
  limit?: number;
}

const ImpactRanking = ({ limit = 10 }: ImpactRankingProps) => {
  const { t } = useTranslation();
  const history = useHistory();
  const [impactData, setImpactData] = useState<DataQualityCheckImpact[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchImpactData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDataQualityCheckImpact({ limit });
      setImpactData(data);
    } catch {
      setImpactData([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchImpactData();
  }, [fetchImpactData]);

  const getImpactColor = (score: number) => {
    if (score >= 70) return 'red';
    if (score >= 40) return 'orange';
    return 'green';
  };

  const getImpactLabel = (score: number) => {
    if (score >= 70) return t('label.critical');
    if (score >= 40) return t('label.high');
    if (score >= 20) return t('label.medium');
    return t('label.low');
  };

  const handleTestCaseClick = (testCaseFQN: string) => {
    history.push(getTestCaseDetailPagePath(testCaseFQN));
  };

  const columns = [
    {
      title: t('label.rank'),
      dataIndex: 'rank',
      key: 'rank',
      width: 60,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: t('label.test-case'),
      dataIndex: 'testCaseFullyQualifiedName',
      key: 'testCaseFullyQualifiedName',
      ellipsis: true,
      render: (text: string, record: DataQualityCheckImpact) => (
        <Button
          type="link"
          onClick={() => handleTestCaseClick(record.testCaseFullyQualifiedName)}>
          {text}
        </Button>
      ),
    },
    {
      title: t('label.entity'),
      dataIndex: 'entityFQN',
      key: 'entityFQN',
      ellipsis: true,
    },
    {
      title: t('label.status'),
      dataIndex: 'testCaseStatus',
      key: 'testCaseStatus',
      render: (status: string) => (
        <Tag color={status === 'Failed' ? 'error' : 'success'}>{status}</Tag>
      ),
    },
    {
      title: t('label.impact-score'),
      dataIndex: 'impactScore',
      key: 'impactScore',
      sorter: (a: DataQualityCheckImpact, b: DataQualityCheckImpact) =>
        b.impactScore - a.impactScore,
      render: (score: number) => (
        <Tooltip title={t('message.impact-score-tooltip')}>
          <Tag color={getImpactColor(score)}>{getImpactLabel(score)}</Tag>
        </Tooltip>
      ),
    },
    {
      title: t('label.downstream'),
      dataIndex: 'downstreamUsage',
      key: 'downstreamUsage',
    },
    {
      title: t('label.consumers'),
      dataIndex: 'consumerCount',
      key: 'consumerCount',
    },
  ];

  const totalCritical =
    impactData.filter((item) => item.impactScore >= 70).length;
  const totalHigh =
    impactData.filter((item) => item.impactScore >= 40 && item.impactScore < 70)
      .length;
  const avgScore =
    impactData.length > 0
      ? Math.round(
          impactData.reduce((sum, item) => sum + item.impactScore, 0) /
            impactData.length
        )
      : 0;

  if (loading) {
    return <Skeleton active />;
  }

  if (isEmpty(impactData)) {
    return (
      <Empty
        description={t('message.no-data-quality-checks-found')}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('label.critical')}
                value={totalCritical}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('label.high')}
                value={totalHigh}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('label.average-impact')}
                value={avgScore}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('label.total-checks')}
                value={impactData.length}
              />
            </Card>
          </Col>
        </Row>
      </Col>
      <Col span={24}>
        <Card title={t('label.data-quality-checks-by-impact')}>
          <Table
            columns={columns}
            dataSource={impactData}
            loading={loading}
            pagination={false}
            rowKey="testCaseId"
          />
        </Card>
      </Col>
    </Row>
  );
};

export default ImpactRanking;