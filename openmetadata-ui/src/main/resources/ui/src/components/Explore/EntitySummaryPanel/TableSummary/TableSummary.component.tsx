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
import { ReactComponent as IconExternalLink } from 'assets/svg/external-links.svg';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import SummaryTagsDescription from 'components/common/SummaryTagsDescription/SummaryTagsDescription.component';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import SummaryPanelSkeleton from 'components/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import TagsViewer from 'components/Tag/TagsViewer/tags-viewer';
import { mockTablePermission } from 'constants/mockTourData.constants';
import { ClientErrors } from 'enums/axios.enum';
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
import { Link, useLocation } from 'react-router-dom';
import { getLatestTableProfileByFqn } from 'rest/tableAPI';
import { getListTestCase } from 'rest/testAPI';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityOverview,
} from 'utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from 'utils/PermissionsUtils';
import { API_RES_MAX_SIZE, ROUTES } from '../../../../constants/constants';
import { INITIAL_TEST_RESULT_SUMMARY } from '../../../../constants/profiler.constant';
import { SummaryEntityType } from '../../../../enums/EntitySummary.enum';
import { Table } from '../../../../generated/entity/data/table';
import { Include } from '../../../../generated/type/include';
import {
  formTwoDigitNmber as formTwoDigitNumber,
  getTagValue,
} from '../../../../utils/CommonUtils';
import { updateTestResults } from '../../../../utils/DataQualityAndProfilerUtils';
import { getFormattedEntityData } from '../../../../utils/EntitySummaryPanelUtils';
import { generateEntityLink } from '../../../../utils/TableUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { TableTestsType } from '../../../TableProfiler/TableProfiler.interface';
import SummaryList from '../SummaryList/SummaryList.component';
import { BasicEntityInfo } from '../SummaryList/SummaryList.interface';
import './table-summary.less';
import { TableSummaryProps } from './TableSummary.interface';

function TableSummary({
  entityDetails,
  componentType = DRAWER_NAVIGATION_OPTIONS.explore,
  tags,
  isLoading,
}: TableSummaryProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const isTourPage = location.pathname.includes(ROUTES.TOUR);
  const { getEntityPermission } = usePermissionProvider();
  const [tableDetails, setTableDetails] = useState<Table>(entityDetails);
  const [tableTests, setTableTests] = useState<TableTestsType>({
    tests: [],
    results: INITIAL_TEST_RESULT_SUMMARY,
  });
  const [tablePermissions, setTablePermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const fetchResourcePermission = useCallback(async () => {
    try {
      const tablePermission = await getEntityPermission(
        ResourceEntity.TABLE,
        tableDetails.id
      );

      setTablePermissions(tablePermission);
    } catch (error) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.resource-permission-lowercase'),
        })
      );
    }
  }, [tableDetails.id, getEntityPermission, setTablePermissions]);

  useEffect(() => {
    if (tableDetails.id && !isTourPage) {
      fetchResourcePermission().catch(() => {
        // error handled in parent
      });
    }

    if (isTourPage) {
      setTablePermissions(mockTablePermission as OperationPermission);
    }
  }, [tableDetails.id]);

  const viewProfilerPermission = useMemo(
    () => tablePermissions.ViewDataProfile || tablePermissions.ViewAll,
    [tablePermissions]
  );

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
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status !== ClientErrors.FORBIDDEN) {
        showErrorToast(
          t('server.entity-details-fetch-error', {
            entityType: t('label.table-lowercase'),
            entityName: entityDetails.name,
          })
        );
      }
    }
  }, [entityDetails]);

  const profilerSummary = useMemo(() => {
    if (!viewProfilerPermission) {
      return (
        <Typography.Text
          className="text-grey-body"
          data-testid="no-permissions-to-view">
          {t('message.no-permission-to-view')}
        </Typography.Text>
      );
    }

    return isUndefined(tableDetails.profile) ? (
      <Typography.Text
        className="text-grey-body"
        data-testid="no-profiler-enabled-message">
        {t('message.no-profiler-enabled-summary-message')}
      </Typography.Text>
    ) : (
      <div className="d-flex justify-between">
        <div className="profiler-item green" data-testid="test-passed">
          <div
            className="font-semibold text-lg"
            data-testid="test-passed-value">
            {formTwoDigitNumber(tableTests.results.success)}
          </div>
          <div className="text-xs text-grey-muted">{`${t(
            'label.test-plural'
          )} ${t('label.passed')}`}</div>
        </div>
        <div className="profiler-item amber" data-testid="test-aborted">
          <div
            className="font-semibold text-lg"
            data-testid="test-aborted-value">
            {formTwoDigitNumber(tableTests.results.aborted)}
          </div>
          <div className="text-xs text-grey-muted">{`${t(
            'label.test-plural'
          )} ${t('label.aborted')}`}</div>
        </div>
        <div className="profiler-item red" data-testid="test-failed">
          <div
            className="font-semibold text-lg"
            data-testid="test-failed-value">
            {formTwoDigitNumber(tableTests.results.failed)}
          </div>
          <div className="text-xs text-grey-muted">{`${t(
            'label.test-plural'
          )} ${t('label.failed')}`}</div>
        </div>
      </div>
    );
  }, [tableDetails, tableTests, viewProfilerPermission]);

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
      const isTourPage = location.pathname.includes(ROUTES.TOUR);
      setTableDetails(entityDetails);

      const shouldFetchProfilerData =
        !isTableDeleted &&
        entityDetails.service?.type === 'databaseService' &&
        !isTourPage &&
        viewProfilerPermission;

      if (shouldFetchProfilerData) {
        fetchProfilerData();
        fetchAllTests();
      }
    }
  }, [entityDetails, viewProfilerPermission]);

  return (
    <SummaryPanelSkeleton loading={isLoading || isEmpty(tableDetails)}>
      <>
        <Row className="m-md m-t-0" gutter={[0, 4]}>
          <Col span={24}>
            <Row gutter={[0, 4]}>
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
                          <Typography.Text className="summary-item-key text-grey-muted">
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
                              <IconExternalLink className="m-l-xs" width={12} />
                            ) : null}
                          </Link>
                        ) : (
                          <Typography.Text
                            className={classNames(
                              'summary-item-value text-grey-muted',
                              {
                                'text-grey-body': !isOwner,
                              }
                            )}>
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

        <Row className="m-md" gutter={[0, 8]}>
          <Col span={24}>
            <Typography.Text
              className="summary-panel-section-title"
              data-testid="profiler-header">
              {t('label.profiler-amp-data-quality')}
            </Typography.Text>
          </Col>
          <Col span={24}>{profilerSummary}</Col>
        </Row>

        <Divider className="m-y-xs" />

        {isExplore ? (
          <>
            <Row className="m-md" gutter={[0, 8]}>
              <Col span={24}>
                <Typography.Text
                  className="summary-panel-section-title"
                  data-testid="tags-header">
                  {t('label.tag-plural')}
                </Typography.Text>
              </Col>

              <Col className="flex-grow" span={24}>
                {entityDetails.tags && entityDetails.tags.length > 0 ? (
                  <TagsViewer
                    sizeCap={2}
                    tags={(entityDetails.tags || []).map((tag) =>
                      getTagValue(tag)
                    )}
                    type="border"
                  />
                ) : (
                  <Typography.Text className="text-grey-body">
                    {t('label.no-tags-added')}
                  </Typography.Text>
                )}
              </Col>
            </Row>
            <Divider className="m-y-xs" />
          </>
        ) : null}
        <Row className="m-md" gutter={[0, 8]}>
          <Col span={24}>
            <Typography.Text
              className="summary-panel-section-title"
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
