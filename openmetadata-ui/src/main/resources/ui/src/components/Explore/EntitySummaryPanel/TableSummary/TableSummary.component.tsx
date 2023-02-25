/*
 *  Copyright 2022 Collate.
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

import { Col, Divider, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, isUndefined } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getLatestTableProfileByFqn,
  getTableQueryByTableId,
} from 'rest/tableAPI';
import { getListTestCase } from 'rest/testAPI';
import { API_RES_MAX_SIZE } from '../../../../constants/constants';
import { INITIAL_TEST_RESULT_SUMMARY } from '../../../../constants/profiler.constant';
import { SummaryEntityType } from '../../../../enums/EntitySummary.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { Table, TableType } from '../../../../generated/entity/data/table';
import { Include } from '../../../../generated/type/include';
import {
  formatNumberWithComma,
  formTwoDigitNmber,
} from '../../../../utils/CommonUtils';
import { updateTestResults } from '../../../../utils/DataQualityAndProfilerUtils';
import { getFormattedEntityData } from '../../../../utils/EntitySummaryPanelUtils';
import { generateEntityLink } from '../../../../utils/TableUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import TableDataCardTitle from '../../../common/table-data-card-v2/TableDataCardTitle.component';
import {
  OverallTableSummeryType,
  TableTestsType,
} from '../../../TableProfiler/TableProfiler.interface';
import SummaryList from '../SummaryList/SummaryList.component';
import { BasicEntityInfo } from '../SummaryList/SummaryList.interface';
import { BasicTableInfo, TableSummaryProps } from './TableSummary.interface';

function TableSummary({ entityDetails }: TableSummaryProps) {
  const { t } = useTranslation();
  const [tableDetails, setTableDetails] = useState<Table>(entityDetails);
  const [tableTests, setTableTests] = useState<TableTestsType>({
    tests: [],
    results: INITIAL_TEST_RESULT_SUMMARY,
  });

  const isTableDeleted = useMemo(() => entityDetails.deleted, [entityDetails]);

  const fetchAllTests = async () => {
    try {
      const { data } = await getListTestCase({
        fields: 'testCaseResult,entityLink,testDefinition,testSuite',
        entityLink: generateEntityLink(entityDetails?.fullyQualifiedName || ''),
        includeAllTests: true,
        limit: API_RES_MAX_SIZE,
        include: Include.Deleted,
      });
      const tableTests: TableTestsType = {
        tests: [],
        results: { ...INITIAL_TEST_RESULT_SUMMARY },
      };
      data.forEach((test) => {
        if (test.entityFQN === entityDetails?.fullyQualifiedName) {
          tableTests.tests.push(test);

          updateTestResults(
            tableTests.results,
            test.testCaseResult?.testCaseStatus || ''
          );
        }
      });
      setTableTests(tableTests);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchProfilerData = async () => {
    try {
      const profileResponse = await getLatestTableProfileByFqn(
        entityDetails?.fullyQualifiedName || ''
      );

      const { profile } = profileResponse;

      const queriesResponse = await getTableQueryByTableId(
        entityDetails.id || ''
      );

      const { tableQueries } = queriesResponse;

      setTableDetails((prev) => {
        if (prev) {
          return { ...prev, profile, tableQueries };
        } else {
          return {} as Table;
        }
      });
    } catch {
      showErrorToast(
        t('server.entity-details-fetch-error', {
          entityType: t('label.table-lowercase'),
          entityName: entityDetails.name,
        })
      );
    }
  };

  const overallSummary: OverallTableSummeryType[] | undefined = useMemo(() => {
    if (isUndefined(tableDetails.profile)) {
      return undefined;
    }

    return [
      {
        title: t('label.entity-count', {
          entity: t('label.row'),
        }),
        value: formatNumberWithComma(tableDetails?.profile?.rowCount ?? 0),
      },
      {
        title: t('label.column-entity', {
          entity: t('label.count'),
        }),
        value:
          tableDetails?.profile?.columnCount ?? entityDetails.columns.length,
      },
      {
        title: `${t('label.table-entity-text', {
          entityText: t('label.sample'),
        })} %`,
        value: `${tableDetails?.profile?.profileSample ?? 100}%`,
      },
      {
        title: `${t('label.test-plural')} ${t('label.passed')}`,
        value: formTwoDigitNmber(tableTests.results.success),
        className: 'success',
      },
      {
        title: `${t('label.test-plural')} ${t('label.aborted')}`,
        value: formTwoDigitNmber(tableTests.results.aborted),
        className: 'aborted',
      },
      {
        title: `${t('label.test-plural')} ${t('label.failed')}`,
        value: formTwoDigitNmber(tableTests.results.failed),
        className: 'failed',
      },
    ];
  }, [tableDetails, tableTests]);

  const { tableType, columns, tableQueries } = tableDetails;

  const basicTableInfo: BasicTableInfo = useMemo(
    () => ({
      Type: tableType || TableType.Regular,
      Queries: tableQueries?.length ? `${tableQueries?.length}` : '-',
      Columns: columns?.length ? `${columns?.length}` : '-',
    }),
    [tableType, columns, tableQueries]
  );

  const formattedColumnsData: BasicEntityInfo[] = useMemo(
    () =>
      getFormattedEntityData(
        SummaryEntityType.COLUMN,
        columns,
        tableDetails.tableConstraints
      ),
    [columns, tableDetails]
  );

  useEffect(() => {
    if (!isEmpty(entityDetails)) {
      setTableDetails(entityDetails);
      fetchAllTests();
      !isTableDeleted && fetchProfilerData();
    }
  }, [entityDetails]);

  return (
    <>
      <Row className={classNames('m-md')} gutter={[0, 4]}>
        <Col span={24}>
          <TableDataCardTitle
            dataTestId="summary-panel-title"
            searchIndex={SearchIndex.TABLE}
            source={tableDetails}
          />
        </Col>
        <Col span={24}>
          <Row>
            {Object.keys(basicTableInfo).map((fieldName) => (
              <Col key={fieldName} span={24}>
                <Row gutter={16}>
                  <Col
                    className="text-gray"
                    data-testid={`${fieldName}-label`}
                    span={10}>
                    {fieldName}
                  </Col>
                  <Col data-testid={`${fieldName}-value`} span={12}>
                    {basicTableInfo[fieldName as keyof BasicTableInfo]}
                  </Col>
                </Row>
              </Col>
            ))}
          </Row>
        </Col>
      </Row>
      <Divider className="m-0" />

      <Row className={classNames('m-md')} gutter={[0, 16]}>
        <Col span={24}>
          <Typography.Text
            className="section-header"
            data-testid="profiler-header">
            {t('label.profiler-amp-data-quality')}
          </Typography.Text>
        </Col>
        <Col span={24}>
          {isUndefined(overallSummary) ? (
            <Typography.Text data-testid="no-profiler-enabled-message">
              {t('message.no-profiler-enabled-summary-message')}
            </Typography.Text>
          ) : (
            <Row gutter={[16, 16]}>
              {overallSummary.map((field) => (
                <Col key={field.title} span={10}>
                  <Row>
                    <Col span={24}>
                      <Typography.Text
                        className="text-gray"
                        data-testid={`${field.title}-label`}>
                        {field.title}
                      </Typography.Text>
                    </Col>
                    <Col span={24}>
                      <Typography.Text
                        className={classNames(
                          'summary-panel-statistics-count',
                          field.className
                        )}
                        data-testid={`${field.title}-value`}>
                        {field.value}
                      </Typography.Text>
                    </Col>
                  </Row>
                </Col>
              ))}
            </Row>
          )}
        </Col>
      </Row>
      <Divider className="m-0" />
      <Row className={classNames('m-md')} gutter={[0, 16]}>
        <Col span={24}>
          <Typography.Text
            className="section-header"
            data-testid="schema-header">
            {t('label.schema')}
          </Typography.Text>
        </Col>
        <Col span={24}>
          <SummaryList
            entityType={SummaryEntityType.COLUMN}
            formattedEntityData={formattedColumnsData}
          />
        </Col>
      </Row>
    </>
  );
}

export default TableSummary;
