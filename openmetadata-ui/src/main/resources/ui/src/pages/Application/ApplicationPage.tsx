/*
 *  Copyright 2023 Collate.
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
import { Button, Card, Col, Row, Skeleton, Space, Switch } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, uniqueId } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import NextPrevious from '../../components/common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import ApplicationCard from '../../components/Settings/Applications/ApplicationCard/ApplicationCard.component';
import { ROUTES } from '../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { App } from '../../generated/entity/applications/app';
import { Include } from '../../generated/type/include';
import { Paging } from '../../generated/type/paging';
import { usePaging } from '../../hooks/paging/usePaging';
import { getApplicationList } from '../../rest/applicationAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { getApplicationDetailsPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const ApplicationPage = () => {
  const { t } = useTranslation();
  const {
    currentPage,
    paging,
    pageSize,
    handlePagingChange,
    handlePageChange,
    handlePageSizeChange,
    showPagination,
  } = usePaging();
  const history = useHistory();
  const [isLoading, setIsLoading] = useState(true);
  const [applicationData, setApplicationData] = useState<App[]>();
  const [showDisabled, setShowDisabled] = useState(false);

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(GlobalSettingsMenuCategory.APPLICATIONS),
    []
  );

  const fetchApplicationList = useCallback(
    async (showDisabled = false, pagingOffset?: Paging) => {
      try {
        setIsLoading(true);
        const { data, paging } = await getApplicationList({
          after: pagingOffset?.after,
          before: pagingOffset?.before,
          limit: pageSize,
          include: showDisabled ? Include.Deleted : Include.NonDeleted,
        });

        setApplicationData(data);
        handlePagingChange(paging);
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [pageSize, handlePagingChange]
  );

  const handleApplicationPageChange = ({
    currentPage,
    cursorType,
  }: PagingHandlerParams) => {
    handlePageChange(currentPage);
    cursorType &&
      fetchApplicationList(showDisabled, {
        [cursorType]: paging[cursorType],
        total: paging.total,
      });
  };

  const viewAppDetails = (item: App) => {
    history.push(getApplicationDetailsPath(item.fullyQualifiedName ?? ''));
  };

  const handleAddApplication = () => {
    history.push(ROUTES.MARKETPLACE);
  };

  const errorPlaceHolder = useMemo(() => {
    if (showDisabled) {
      return (
        <Col className="mt-24 text-center" span={24}>
          <ErrorPlaceHolder heading={t('label.application-plural')} />
        </Col>
      );
    }

    return (
      <Col className="mt-24 text-center" span={24}>
        <ErrorPlaceHolder
          heading={t('label.application-plural')}
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          <div>{t('message.no-installed-applications-found')}</div>
        </ErrorPlaceHolder>
      </Col>
    );
  }, [showDisabled]);

  const onShowDisabledAppsChange = (value: boolean) => {
    setShowDisabled(value);
    fetchApplicationList(value);
  };

  useEffect(() => {
    fetchApplicationList();
  }, [pageSize]);

  return (
    <PageLayoutV1 pageTitle={t('label.application-plural')}>
      <Row className="page-container" gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col span={16}>
          <PageHeader data={PAGE_HEADERS.APPLICATION} />
        </Col>
        <Col className="d-flex justify-end" span={8}>
          <Space size="middle">
            <div>
              <Switch
                checked={showDisabled}
                data-testid="show-disabled"
                onClick={onShowDisabledAppsChange}
              />
              <span className="m-l-xs">{t('label.disabled')}</span>
            </div>
            <Button
              data-testid="add-application"
              type="primary"
              onClick={handleAddApplication}>
              {t('label.add-entity', {
                entity: t('label.app-plural'),
              })}
            </Button>
          </Space>
        </Col>
      </Row>
      <Row className="page-container m-t-lg">
        {isLoading &&
          [1, 2, 3].map((key) => (
            <Col key={key} span={8}>
              <Card className="w-400">
                <Skeleton active paragraph title />
              </Card>
            </Col>
          ))}

        {isEmpty(applicationData) && !isLoading && errorPlaceHolder}

        {!isLoading && (
          <>
            <Col span={24}>
              <div className="d-flex flex-wrap gap-3">
                {applicationData?.map((item) => (
                  <ApplicationCard
                    appName={item.fullyQualifiedName ?? ''}
                    className="w-400"
                    deleted={item.deleted}
                    description={item.description ?? ''}
                    key={uniqueId()}
                    linkTitle={t('label.configure')}
                    showDescription={false}
                    title={getEntityName(item)}
                    onClick={() => viewAppDetails(item)}
                  />
                ))}
              </div>
            </Col>
            <Col span={24}>
              {showPagination && (
                <NextPrevious
                  currentPage={currentPage}
                  pageSize={pageSize}
                  paging={paging}
                  pagingHandler={handleApplicationPageChange}
                  onShowSizeChange={handlePageSizeChange}
                />
              )}
            </Col>
          </>
        )}
      </Row>
    </PageLayoutV1>
  );
};

export default ApplicationPage;
