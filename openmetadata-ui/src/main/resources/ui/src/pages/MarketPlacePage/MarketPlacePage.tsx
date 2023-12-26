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
import { Col, Row } from 'antd';
import { AxiosError } from 'axios';
import { uniqueId } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as HeadingIcon } from '../../assets/svg/marketplace-heading.svg';
import ApplicationCard from '../../components/Applications/ApplicationCard/ApplicationCard.component';
import NextPrevious from '../../components/common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import Loader from '../../components/Loader/Loader';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { AppMarketPlaceDefinition } from '../../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import { Paging } from '../../generated/type/paging';
import { usePaging } from '../../hooks/paging/usePaging';
import { getMarketPlaceApplicationList } from '../../rest/applicationMarketPlaceAPI';
import { getEntityName } from '../../utils/EntityUtils';
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
  } = usePaging();
  const history = useHistory();
  const [isLoading, setIsLoading] = useState(true);
  const [applicationData, setApplicationData] =
    useState<AppMarketPlaceDefinition[]>();

  const fetchApplicationList = useCallback(
    async (pagingOffset?: Paging) => {
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
    handlePageChange(currentPage);
    cursorType &&
      fetchApplicationList({
        [cursorType]: paging[cursorType],
        total: paging.total,
      } as Paging);
  };

  const viewAppDetails = (item: AppMarketPlaceDefinition) => {
    history.push(getMarketPlaceAppDetailsPath(item.fullyQualifiedName ?? ''));
  };

  useEffect(() => {
    fetchApplicationList();
  }, [pageSize]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1
      className="p-0 marketplace-page"
      pageTitle={t('label.market-place')}>
      <Row className="marketplace-header">
        <Col span={24}>
          <TitleBreadcrumb
            className="p-md"
            titleLinks={[
              {
                name: t('label.application-plural'),
                url: getSettingPath(
                  GlobalSettingsMenuCategory.INTEGRATIONS,
                  GlobalSettingOptions.APPLICATIONS
                ),
              },
              {
                name: t('label.market-place'),
                url: '',
              },
            ]}
          />
        </Col>
        <Col span={24}>
          <Row className="marketplace-header-row" justify="center">
            <Col span={18}>
              <div className="d-flex items-center justify-between h-full">
                <PageHeader data={PAGE_HEADERS.APPLICATION} />
                <HeadingIcon />
              </div>
            </Col>
          </Row>
        </Col>
      </Row>

      <Row className="m-t-lg" justify="center">
        <Col span={18}>
          <div className="d-flex flex-wrap gap-3">
            {applicationData?.map((item) => (
              <ApplicationCard
                appName={item.fullyQualifiedName ?? ''}
                className="w-400"
                description={item.description ?? ''}
                key={uniqueId()}
                linkTitle={t('label.read-type', {
                  type: t('label.more'),
                })}
                title={getEntityName(item)}
                onClick={() => viewAppDetails(item)}
              />
            ))}
          </div>
        </Col>
        <Col span={18}>
          {showPagination && (
            <NextPrevious
              currentPage={currentPage}
              pageSize={pageSize}
              paging={paging}
              pagingHandler={handleMarketPlacePageChange}
              onShowSizeChange={handlePageSizeChange}
            />
          )}
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default MarketPlacePage;
