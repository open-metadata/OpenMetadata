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
import { Button, Card, Col, Row, Skeleton, Space } from 'antd';
import { Switch } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, uniqueId } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
import LimitWrapper from '../../hoc/LimitWrapper';
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
  const navigate = useNavigate();
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
    navigate(getApplicationDetailsPath(item.fullyQualifiedName ?? ''));
  };

  const handleAddApplication = () => {
    navigate(ROUTES.MARKETPLACE);
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
      <Row gutter={[0, 16]}>
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
            <LimitWrapper resource="app">
              <Button
                data-testid="add-application"
                type="primary"
                onClick={handleAddApplication}>
                {t('label.add-entity', {
                  entity: t('label.app-plural'),
                })}
              </Button>
            </LimitWrapper>
          </Space>
        </Col>
      </Row>
      <Row className="m-t-lg" gutter={[20, 20]}>
        {isLoading &&
          [1, 2, 3, 4].map((key) => (
            <Col key={key} lg={8} md={12} sm={24} xl={6}>
              <Card>
                <Skeleton active paragraph title />
              </Card>
            </Col>
          ))}

        {isEmpty(applicationData) && !isLoading && errorPlaceHolder}

        {!isLoading && (
          <>
            <Col span={24}>
              <Row className="applications-card-container" gutter={[20, 20]}>
                {applicationData?.map((item) => (
                  <Col
                    key={item.fullyQualifiedName}
                    lg={8}
                    md={12}
                    sm={24}
                    xl={6}>
                    <ApplicationCard
                      appName={item.fullyQualifiedName ?? ''}
                      deleted={item.deleted}
                      description={item.description ?? ''}
                      key={uniqueId()}
                      linkTitle={t('label.configure')}
                      showDescription={false}
                      title={getEntityName(item)}
                      onClick={() => viewAppDetails(item)}
                    />
                  </Col>
                ))}
              </Row>
            </Col>
            <Col span={24}>
              {showPagination && (
                <NextPrevious
                  currentPage={currentPage}
                  isLoading={isLoading}
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
