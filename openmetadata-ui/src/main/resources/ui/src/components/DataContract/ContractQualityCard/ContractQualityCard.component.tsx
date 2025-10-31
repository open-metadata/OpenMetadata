/*
 *  Copyright 2025 Collate.
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
import Icon from '@ant-design/icons';
import { Col, Row, Space, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ES_MAX_PAGE_SIZE } from '../../../constants/constants';
import { TEST_CASE_STATUS_ICON } from '../../../constants/DataQuality.constants';
import { DEFAULT_SORT_ORDER } from '../../../constants/profiler.constant';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { DataContractResult } from '../../../generated/entity/datacontract/dataContractResult';
import { TestCase, TestCaseStatus } from '../../../generated/tests/testCase';
import { Include } from '../../../generated/type/include';
import { useFqn } from '../../../hooks/useFqn';
import { getListTestCaseBySearch } from '../../../rest/testAPI';
import { getContractStatusType } from '../../../utils/DataContract/DataContractUtils';
import { getTestCaseDetailPagePath } from '../../../utils/RouterUtils';
import { generateEntityLink } from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../../common/Loader/Loader';
import StatusBadgeV2 from '../../common/StatusBadge/StatusBadgeV2.component';
import './contract-quality-card.less';

const ContractQualityCard: React.FC<{
  contract: DataContract;
  contractStatus?: string;
  latestContractResults?: DataContractResult;
}> = ({ contract, contractStatus, latestContractResults }) => {
  const { t } = useTranslation();
  const { fqn } = useFqn();
  const [isTestCaseLoading, setIsTestCaseLoading] = useState(false);
  const [testCase, setTestCase] = useState<TestCase[]>([]);

  const fetchTestCases = async () => {
    setIsTestCaseLoading(true);
    try {
      const { data } = await getListTestCaseBySearch({
        ...DEFAULT_SORT_ORDER,
        entityLink: generateEntityLink(fqn ?? ''),
        includeAllTests: true,
        limit: ES_MAX_PAGE_SIZE,
        include: Include.NonDeleted,
      });

      setTestCase(data);
    } catch (error) {
      showErrorToast(
        t('server.entity-fetch-error', {
          entity: t('label.test-case-plural'),
        })
      );
    } finally {
      setIsTestCaseLoading(false);
    }
  };

  const {
    showTestCaseSummaryChart,
    segmentWidths,
    total,
    success,
    failed,
    aborted,
  } = useMemo(() => {
    if (!latestContractResults?.qualityValidation) {
      return {
        showTestCaseSummaryChart: false,
        segmentWidths: {
          successPercent: 0,
          failedPercent: 0,
          abortedPercent: 0,
        },
        total: 0,
        success: 0,
        failed: 0,
        aborted: 0,
      };
    }

    const { qualityValidation } = latestContractResults;
    const total = qualityValidation?.total ?? 0;
    const success = qualityValidation?.passed ?? 0;
    const failed = qualityValidation?.failed ?? 0;
    const aborted = total - success - failed;

    const successPercent = (success / total) * 100;
    const failedPercent = (failed / total) * 100;
    const abortedPercent = (aborted / total) * 100;

    return {
      showTestCaseSummaryChart: true,
      segmentWidths: {
        successPercent,
        failedPercent,
        abortedPercent,
      },
      total,
      success,
      failed,
      aborted,
    };
  }, [latestContractResults?.qualityValidation]);

  const processedQualityExpectations = useMemo(() => {
    const testCaseResultsMap = new Map(
      testCase.map((result) => [result.id, result])
    );

    const mergedData = contract.qualityExpectations?.map((item) => ({
      id: item.id,
      name: item.name,
      fullyQualifiedName: `${fqn}.${item.name}`,
      testCaseStatus:
        testCaseResultsMap.get(item.id)?.testCaseStatus ??
        TestCaseStatus.Queued,
    }));

    return mergedData ?? [];
  }, [contract, testCase]);

  useEffect(() => {
    fetchTestCases();
  }, []);

  if (isTestCaseLoading) {
    return <Loader />;
  }

  return (
    <Row className="data-quality-card-container" gutter={[20, 0]}>
      <Col span={12}>
        {showTestCaseSummaryChart && (
          <>
            <Typography.Text className="data-quality-total-test">
              {`${t('label.total-entity', {
                entity: t('label.test'),
              })}:`}{' '}
              <span className="data-quality-total-test-value">{total}</span>
            </Typography.Text>

            <div className="data-quality-line-chart-container">
              <div
                className="data-quality-line-chart-item success"
                style={{
                  width: `${segmentWidths.successPercent}%`,
                }}
              />
              <div
                className="data-quality-line-chart-item failed"
                style={{
                  width: `${segmentWidths.failedPercent}%`,
                }}
              />
              <div
                className="data-quality-line-chart-item aborted"
                style={{
                  width: `${segmentWidths.abortedPercent}%`,
                }}
              />
            </div>

            <div className="data-quality-legends-container">
              <div className="data-quality-legends-item">
                <div className="data-quality-legends-dot success" />
                <Typography.Text className="data-quality-legends-label">
                  {`${t('label.success')}:`}{' '}
                  <span className="data-quality-legends-value">{success}</span>
                </Typography.Text>
              </div>
              <div className="data-quality-legends-item">
                <div className="data-quality-legends-dot failed" />
                <Typography.Text className="data-quality-legends-label">
                  {`${t('label.failed')}:`}{' '}
                  <span className="data-quality-legends-value">{failed}</span>
                </Typography.Text>
              </div>
              <div className="data-quality-legends-item">
                <div className="data-quality-legends-dot aborted" />
                <Typography.Text className="data-quality-legends-label">
                  {`${t('label.aborted')}:`}{' '}
                  <span className="data-quality-legends-value">{aborted}</span>
                </Typography.Text>
              </div>
            </div>
          </>
        )}

        <Space
          className="data-quality-test-item-container"
          direction="vertical"
          size={14}>
          {processedQualityExpectations.map((item) => {
            return (
              <div
                className="data-quality-item d-flex items-center"
                key={item.id}>
                <Icon
                  className="test-status-icon"
                  component={TEST_CASE_STATUS_ICON[item.testCaseStatus]}
                />
                <div className="data-quality-item-content">
                  <Link
                    className="data-quality-item-name-link"
                    to={getTestCaseDetailPagePath(item.fullyQualifiedName)}>
                    {item.name}
                  </Link>
                </div>
              </div>
            );
          })}
        </Space>
      </Col>
      <Col className="d-flex justify-end" span={12}>
        {contractStatus && (
          <div className="contract-status-container">
            <Typography.Text>{`${t('label.entity-status', {
              entity: t('label.quality'),
            })} :`}</Typography.Text>
            <StatusBadgeV2
              dataTestId="contract-status-card-item-quality-status"
              label={contractStatus}
              status={getContractStatusType(contractStatus)}
            />
          </div>
        )}
      </Col>
    </Row>
  );
};

export default ContractQualityCard;
