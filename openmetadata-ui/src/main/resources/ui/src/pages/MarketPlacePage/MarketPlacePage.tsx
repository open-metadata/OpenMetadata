import { Col, Row } from 'antd';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as HeadingIcon } from '../../assets/svg/marketplace-heading.svg';
import ApplicationCard from '../../components/Applications/ApplicationCard/ApplicationCard.component';
import Loader from '../../components/Loader/Loader';
import NextPrevious from '../../components/common/next-previous/NextPrevious';
import { PagingHandlerParams } from '../../components/common/next-previous/NextPrevious.interface';
import PageLayoutV1 from '../../components/containers/PageLayoutV1';
import PageHeader from '../../components/header/PageHeader.component';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { AppMarketPlaceDefinition } from '../../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import { Paging } from '../../generated/type/paging';
import { usePaging } from '../../hooks/paging/usePaging';
import { getMarketPlaceApplicationList } from '../../rest/applicationMarketPlaceAPI';
import { showPagination } from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { getMarketPlaceAppDetailsPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './market-place.less';
import { uniqueId } from 'lodash';

const MarketPlacePage = () => {
  const { t } = useTranslation();
  const {
    currentPage,
    paging,
    pageSize,
    handlePagingChange,
    handlePageChange,
    handlePageSizeChange,
  } = usePaging();
  const history = useHistory();
  const [isLoading, setIsLoading] = useState(true);
  const [applicationData, setApplicationData] =
    useState<AppMarketPlaceDefinition[]>();

  const fetchApplicationList = useCallback(async (pagingOffset?: Paging) => {
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
  }, []);

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
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1
      className="p-0 marketplace-page"
      pageTitle={t('label.market-place')}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <div className="marketplace-header d-flex items-center justify-between">
            <PageHeader data={PAGE_HEADERS.APPLICATION} />
            <HeadingIcon />
          </div>
        </Col>
      </Row>
      <Row className="m-t-lg" justify="center">
        <Col span={20}>
          <div className="d-flex flex-wrap gap-3">
            {applicationData?.map((item) => (
              <ApplicationCard
                key={uniqueId()}
                logoSrc={''}
                className="w-400"
                title={getEntityName(item)}
                description={item.description ?? ''}
                linkTitle={t('label.read-type', {
                  type: t('label.more'),
                })}
                onClick={() => viewAppDetails(item)}
              />
            ))}
          </div>
        </Col>
        <Col span={20}>
          {showPagination(paging) && (
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
