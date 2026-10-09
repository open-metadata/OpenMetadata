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
import {
  Box,
  Grid,
  SkeletonParagraph,
  Toggle,
} from '@openmetadata/ui-core-components';
import { Button, Card } from 'antd';
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
import { LEARNING_PAGE_IDS } from '../../constants/Learning.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { App } from '../../generated/entity/applications/app';
import { Include } from '../../generated/type/include';
import { Paging } from '../../generated/type/paging';
import LimitWrapper from '../../hoc/LimitWrapper';
import { usePaging } from '../../hooks/paging/usePaging';
import { getApplicationList } from '../../rest/applicationAPI';
import { isCacheWarmupApplication } from '../../utils/ApplicationUtils';
import { getLayoutGutter } from '../../utils/common/layout.utils';
import { getEntityName } from '../../utils/EntityNameUtils';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { translateWithNestedKeys } from '../../utils/i18next/LocalUtil';
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
    pagingCursor,
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
    async (showDisabled = false, pagingOffset?: Partial<Paging>) => {
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
    if (cursorType) {
      fetchApplicationList(showDisabled, {
        [cursorType]: paging[cursorType],
        total: paging.total,
      });
      handlePageChange(
        currentPage,
        { cursorType, cursorValue: paging[cursorType] },
        pageSize
      );
    }
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
        <Grid.Item className="layout-column mt-24 text-center" span={24}>
          <ErrorPlaceHolder heading={t('label.application-plural')} />
        </Grid.Item>
      );
    }

    return (
      <Grid.Item className="layout-column mt-24 text-center" span={24}>
        <ErrorPlaceHolder
          heading={t('label.application-plural')}
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          <div>{t('message.no-installed-applications-found')}</div>
        </ErrorPlaceHolder>
      </Grid.Item>
    );
  }, [showDisabled]);

  const onShowDisabledAppsChange = (value: boolean) => {
    setShowDisabled(value);
    fetchApplicationList(value);
  };

  useEffect(() => {
    const { cursorType, cursorValue } = pagingCursor ?? {};

    if (cursorType && cursorValue) {
      fetchApplicationList(showDisabled, { [cursorType]: cursorValue });
    } else {
      fetchApplicationList(showDisabled);
    }
  }, [pageSize, pagingCursor, showDisabled]);

  return (
    <PageLayoutV1 pageTitle={t('label.application-plural')}>
      <Grid
        className="layout-row layout-grid"
        style={{ ...getLayoutGutter(0, 16) }}>
        <Grid.Item className="layout-column" span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Grid.Item>
        <Grid.Item className="layout-column" span={16}>
          <PageHeader
            data={{
              header: translateWithNestedKeys(
                PAGE_HEADERS.APPLICATION.header,
                PAGE_HEADERS.APPLICATION.headerParams
              ),
              subHeader: t(PAGE_HEADERS.APPLICATION.subHeader),
            }}
            learningPageId={LEARNING_PAGE_IDS.AUTOMATIONS}
          />
        </Grid.Item>
        <Grid.Item className="layout-column d-flex justify-end" span={8}>
          <Box
            inline
            align="center"
            className="layout-space layout-space-horizontal"
            gap={4}
            itemClassName="layout-space-item">
            <div className="flex-center gap-2">
              <Toggle
                data-testid="show-disabled"
                isSelected={showDisabled}
                onChange={onShowDisabledAppsChange}
              />
              <span>{t('label.disabled')}</span>
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
          </Box>
        </Grid.Item>
      </Grid>
      <Grid
        className="layout-row layout-grid m-t-lg"
        style={{ ...getLayoutGutter(20, 20) }}>
        {isLoading &&
          [1, 2, 3, 4].map((key) => (
            <Grid.Item
              className="layout-column tw:col-span-24 tw:min-[576px]:col-span-24 tw:min-[768px]:col-span-12 tw:min-[992px]:col-span-8 tw:min-[1200px]:col-span-6"
              key={key}>
              <Card>
                <SkeletonParagraph />
              </Card>
            </Grid.Item>
          ))}

        {isEmpty(applicationData) && !isLoading && errorPlaceHolder}

        {!isLoading && (
          <>
            <Grid.Item className="layout-column" span={24}>
              <Grid
                className="layout-row layout-grid applications-card-container"
                style={{ ...getLayoutGutter(20, 20) }}>
                {applicationData?.map((item) => {
                  const disabledReason =
                    item.enabled === false &&
                    isCacheWarmupApplication(item.name)
                      ? t('message.cache-service-not-configured-message')
                      : undefined;

                  return (
                    <Grid.Item
                      className="layout-column tw:col-span-24 tw:min-[576px]:col-span-24 tw:min-[768px]:col-span-12 tw:min-[992px]:col-span-8 tw:min-[1200px]:col-span-6"
                      key={item.fullyQualifiedName}>
                      <ApplicationCard
                        appName={item.fullyQualifiedName ?? ''}
                        deleted={item.deleted}
                        description={item.description ?? ''}
                        disabled={item.enabled === false}
                        disabledReason={disabledReason}
                        key={uniqueId()}
                        linkTitle={t('label.configure')}
                        showDescription={false}
                        title={getEntityName(item)}
                        onClick={() => viewAppDetails(item)}
                      />
                    </Grid.Item>
                  );
                })}
              </Grid>
            </Grid.Item>
            <Grid.Item className="layout-column" span={24}>
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
            </Grid.Item>
          </>
        )}
      </Grid>
    </PageLayoutV1>
  );
};

export default ApplicationPage;
