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
import { Box, Grid } from '@openmetadata/ui-core-components';
import { getLayoutGutter } from '../../utils/common/layout.utils';

import { AxiosError } from 'axios';
import { uniqueId } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as HeadingIcon } from '../../assets/svg/marketplace-heading.svg';
import Loader from '../../components/common/Loader/Loader';
import NextPrevious from '../../components/common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import ApplicationCard from '../../components/Settings/Applications/ApplicationCard/ApplicationCard.component';
import { GlobalSettingOptions } from '../../constants/GlobalSettings.constants';
import { LEARNING_PAGE_IDS } from '../../constants/Learning.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { AppMarketPlaceDefinition } from '../../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import { Paging } from '../../generated/type/paging';
import { usePaging } from '../../hooks/paging/usePaging';
import { getMarketPlaceApplicationList } from '../../rest/applicationMarketPlaceAPI';
import { isCacheWarmupApplication } from '../../utils/ApplicationUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import { translateWithNestedKeys } from '../../utils/i18next/LocalUtil';
import {
  getMarketPlaceAppDetailsPath,
  getSettingPath,
} from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './market-place.less';

const MarketPlacePage = () => {
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
  const [applicationData, setApplicationData] =
    useState<AppMarketPlaceDefinition[]>();

  const fetchApplicationList = useCallback(
    async (pagingOffset?: Partial<Paging>) => {
      try {
        setIsLoading(true);
        const { data, paging } = await getMarketPlaceApplicationList({
          after: pagingOffset?.after,
          before: pagingOffset?.before,
          limit: pageSize,
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

  const handleMarketPlacePageChange = ({
    currentPage,
    cursorType,
  }: PagingHandlerParams) => {
    if (cursorType) {
      fetchApplicationList({
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

  const viewAppDetails = (item: AppMarketPlaceDefinition) => {
    navigate(getMarketPlaceAppDetailsPath(item.fullyQualifiedName ?? ''));
  };

  useEffect(() => {
    const { cursorType, cursorValue } = pagingCursor ?? {};

    if (cursorType && cursorValue) {
      fetchApplicationList({ [cursorType]: cursorValue });
    } else {
      fetchApplicationList();
    }
  }, [pageSize, pagingCursor]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1
      className="marketplace-page"
      pageTitle={t('label.market-place')}>
      <Grid className="layout-row layout-grid marketplace-header">
        <Grid.Item className="layout-column" span={24}>
          <TitleBreadcrumb
            className="p-md"
            titleLinks={[
              {
                name: t('label.application-plural'),
                url: getSettingPath(GlobalSettingOptions.APPLICATIONS),
              },
              {
                name: t('label.market-place'),
                url: '',
              },
            ]}
          />
        </Grid.Item>
        <Grid.Item className="layout-column" span={24}>
          <Box
            className="layout-row marketplace-header-row"
            justify="center"
            wrap="wrap">
            <Box
              className="layout-column tw:block"
              style={{ maxWidth: '75%', flex: '0 0 75%' }}>
              <div className="d-flex items-center justify-between h-full">
                <PageHeader
                  data={{
                    header: translateWithNestedKeys(
                      PAGE_HEADERS.APPLICATION.header,
                      PAGE_HEADERS.APPLICATION.headerParams
                    ),
                    subHeader: t(PAGE_HEADERS.APPLICATION.subHeader),
                  }}
                  learningPageId={LEARNING_PAGE_IDS.AUTOMATIONS}
                  title={t('label.market-place')}
                />
                <HeadingIcon />
              </div>
            </Box>
          </Box>
        </Grid.Item>
      </Grid>

      <Box className="layout-row m-t-lg" justify="center" wrap="wrap">
        <Box
          className="layout-column tw:block"
          style={{
            maxWidth: '83.33333333333334%',
            flex: '0 0 83.33333333333334%',
          }}>
          <Grid
            className="layout-row layout-grid marketplace-card-container"
            style={{ ...getLayoutGutter(20, 20) }}>
            {applicationData?.map((item) => {
              const disabledReason =
                item.enabled === false && isCacheWarmupApplication(item.name)
                  ? t('message.cache-service-not-configured-message')
                  : undefined;

              return (
                <Grid.Item
                  className="layout-column tw:col-span-24 tw:min-[576px]:col-span-24 tw:min-[768px]:col-span-12 tw:min-[992px]:col-span-8"
                  key={item.fullyQualifiedName}>
                  <ApplicationCard
                    appName={item.fullyQualifiedName ?? ''}
                    description={item.description ?? ''}
                    disabled={item.enabled === false}
                    disabledReason={disabledReason}
                    key={uniqueId()}
                    linkTitle={t('label.read-type', {
                      type: t('label.more'),
                    })}
                    title={getEntityName(item)}
                    onClick={() => viewAppDetails(item)}
                  />
                </Grid.Item>
              );
            })}
          </Grid>
        </Box>
        <Box
          className="layout-column tw:block"
          style={{ maxWidth: '75%', flex: '0 0 75%' }}>
          {showPagination && (
            <NextPrevious
              currentPage={currentPage}
              isLoading={isLoading}
              pageSize={pageSize}
              paging={paging}
              pagingHandler={handleMarketPlacePageChange}
              onShowSizeChange={handlePageSizeChange}
            />
          )}
        </Box>
      </Box>
    </PageLayoutV1>
  );
};

export default MarketPlacePage;
