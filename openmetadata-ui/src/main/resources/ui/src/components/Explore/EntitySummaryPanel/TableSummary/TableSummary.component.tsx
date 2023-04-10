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
import SummaryTagsDescription from 'components/common/SummaryTagsDescription/SummaryTagsDescription.component';
import SummaryPanelSkeleton from 'components/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import { ExplorePageTabs } from 'enums/Explore.enum';
import { isEmpty, isUndefined } from 'lodash';
import {
  default as React,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getLatestTableProfileByFqn } from 'rest/tableAPI';
import { getListTestCase } from 'rest/testAPI';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityOverview,
} from 'utils/EntityUtils';
import SVGIcons from 'utils/SvgUtils';
import { API_RES_MAX_SIZE } from '../../../../constants/constants';
import { INITIAL_TEST_RESULT_SUMMARY } from '../../../../constants/profiler.constant';
import { SummaryEntityType } from '../../../../enums/EntitySummary.enum';
import { Table } from '../../../../generated/entity/data/table';
import { Include } from '../../../../generated/type/include';
import {
  formatNumberWithComma,
  formTwoDigitNmber as formTwoDigitNumber,
} from '../../../../utils/CommonUtils';
import { updateTestResults } from '../../../../utils/DataQualityAndProfilerUtils';
import { getFormattedEntityData } from '../../../../utils/EntitySummaryPanelUtils';
import { generateEntityLink } from '../../../../utils/TableUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import {
  OverallTableSummeryType,
  TableTestsType,
} from '../../../TableProfiler/TableProfiler.interface';
import SummaryList from '../SummaryList/SummaryList.component';
import { BasicEntityInfo } from '../SummaryList/SummaryList.interface';
import { TableSummaryProps } from './TableSummary.interface';

function TableSummary({
  entityDetails,
  componentType = DRAWER_NAVIGATION_OPTIONS.explore,
  tags,
  isLoading,
}: TableSummaryProps) {
  const { t } = useTranslation();
  const [tableDetails, setTableDetails] = useState<Table>(entityDetails);
  const [tableTests, setTableTests] = useState<TableTestsType>({
    tests: [],
    results: INITIAL_TEST_RESULT_SUMMARY,
  });

  const isExplore = useMemo(
    () => componentType === DRAWER_NAVIGATION_OPTIONS.explore,
    [componentType]
  );

  const isTableDeleted = useMemo(() => entityDetails.deleted, [entityDetails]);

  const fetchAllTests = async () => {
    try {
      const { data } = await getListTestCase({
        fields: 'testCaseResult',
        entityLink: generateEntityLink(entityDetails?.fullyQualifiedName || ''),
        includeAllTests: true,
        limit: API_RES_MAX_SIZE,
        include: Include.NonDeleted,
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

  const fetchProfilerData = useCallback(async () => {
    try {
      const profileResponse = await getLatestTableProfileByFqn(
        entityDetails?.fullyQualifiedName || ''
      );

      const { profile, tableConstraints } = profileResponse;

      setTableDetails((prev) => {
        if (prev) {
          return { ...prev, profile, tableConstraints };
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
  }, [entityDetails]);

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
        value: formTwoDigitNumber(tableTests.results.success),
        className: 'success',
      },
      {
        title: `${t('label.test-plural')} ${t('label.aborted')}`,
        value: formTwoDigitNumber(tableTests.results.aborted),
        className: 'aborted',
      },
      {
        title: `${t('label.test-plural')} ${t('label.failed')}`,
        value: formTwoDigitNumber(tableTests.results.failed),
        className: 'failed',
      },
    ];
  }, [tableDetails, tableTests]);

  const { columns } = tableDetails;

  const entityInfo = useMemo(
    () => getEntityOverview(ExplorePageTabs.TABLES, tableDetails),
    [tableDetails]
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
      if (
        !isTableDeleted &&
        entityDetails.service?.type === 'databaseService'
      ) {
        fetchProfilerData();
        fetchAllTests();
      }
    }
  }, [entityDetails]);

  console.log(tableDetails);

  return (
    <SummaryPanelSkeleton loading={isLoading || isEmpty(tableDetails)}>
      <>
        <Row className="m-md" gutter={[0, 4]}>
          <Col span={24}>
            <Row>
              {entityInfo.map((info) => {
                const isOwner = info.name === t('label.owner');

                return info.visible?.includes(componentType) ? (
                  <Col key={info.name} span={24}>
                    <Row
                      className={classNames('', {
                        'p-b-md': isOwner,
                      })}
                      gutter={[16, 32]}>
                      {!isOwner ? (
                        <Col data-testid={`${info.name}-label`} span={8}>
                          <Typography.Text className="text-grey-muted">
                            {info.name}
                          </Typography.Text>
                        </Col>
                      ) : null}
                      <Col data-testid={`${info.name}-value`} span={16}>
                        {info.isLink ? (
                          <Link
                            component={Typography.Link}
                            target={info.isExternal ? '_blank' : '_self'}
                            to={{ pathname: info.url }}>
                            {info.value}
                            {info.isExternal ? (
                              <SVGIcons
                                alt="external-link"
                                className="m-l-xs"
                                icon="external-link"
                                width="12px"
                              />
                            ) : null}
                          </Link>
                        ) : (
                          <Typography.Text
                            className={classNames('text-grey-muted', {
                              'text-grey-body': !isOwner,
                            })}>
                            {info.value}
                          </Typography.Text>
                        )}
                      </Col>
                    </Row>
                  </Col>
                ) : null;
              })}
            </Row>
          </Col>
        </Row>

        <Divider className="m-y-xs" />

        {!isExplore ? (
          <>
            <SummaryTagsDescription
              entityDetail={entityDetails}
              tags={tags ? tags : []}
            />
            <Divider className="m-y-xs" />
          </>
        ) : null}

        <Row className="m-md" gutter={[0, 16]}>
          <Col span={24}>
            <Typography.Text
              className="text-base text-grey-muted"
              data-testid="profiler-header">
              {t('label.profiler-amp-data-quality')}
            </Typography.Text>
          </Col>
          <Col span={24}>
            {isUndefined(overallSummary) ? (
              <Typography.Text
                className="text-grey-body"
                data-testid="no-profiler-enabled-message">
                {t('message.no-profiler-enabled-summary-message')}
              </Typography.Text>
            ) : (
              <Row gutter={[0, 16]}>
                {overallSummary.map((field) => (
                  <Col key={field.title} span={10}>
                    <Row>
                      <Col span={24}>
                        <Typography.Text
                          className="text-grey-muted"
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

        <Divider className="m-y-xs" />

        <Row className="m-md" gutter={[0, 16]}>
          <Col span={24}>
            <Typography.Text
              className="text-base text-grey-muted"
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
    </SummaryPanelSkeleton>
  );
}

export default TableSummary;
