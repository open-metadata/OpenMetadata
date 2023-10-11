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
import { Button, Col, Row } from 'antd';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import ApplicationCard from '../../components/Applications/ApplicationCard/ApplicationCard.component';
import Loader from '../../components/Loader/Loader';
import NextPrevious from '../../components/common/next-previous/NextPrevious';
import { PagingHandlerParams } from '../../components/common/next-previous/NextPrevious.interface';
import PageHeader from '../../components/header/PageHeader.component';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { ROUTES } from '../../constants/constants';
import { App } from '../../generated/entity/applications/app';
import { Paging } from '../../generated/type/paging';
import { usePaging } from '../../hooks/paging/usePaging';
import { getApplicationList } from '../../rest/applicationAPI';
import { showPagination } from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { getApplicationDetailsPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { uniqueId } from 'lodash';

const ApplicationPage = () => {
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
  const [applicationData, setApplicationData] = useState<App[]>();

  const fetchApplicationList = useCallback(async (pagingOffset?: Paging) => {
    try {
      setIsLoading(true);
      const { data, paging } = await getApplicationList({
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

  const handleBotPageChange = ({
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

  const viewAppDetails = (item: App) => {
    history.push(getApplicationDetailsPath(item.fullyQualifiedName ?? ''));
  };

  const handleAddApplication = () => {
    history.push(ROUTES.MARKETPLACE);
  };

  useEffect(() => {
    fetchApplicationList();
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <>
      <Row gutter={[16, 16]}>
        <Col span={20}>
          <PageHeader data={PAGE_HEADERS.APPLICATION} />
        </Col>
        <Col className="d-flex justify-end" span={4}>
          <Button
            data-testid="add-application"
            type="primary"
            onClick={handleAddApplication}>
            {t('label.add-entity', {
              entity: t('label.app-plural'),
            })}
          </Button>
        </Col>
      </Row>
      <Row className="m-t-lg">
        <Col span={24}>
          <div className="d-flex flex-wrap gap-3">
            {applicationData?.map((item) => (
              <ApplicationCard
                key={uniqueId()}
                className="w-400"
                title={getEntityName(item)}
                description={item.description ?? ''}
                linkTitle={t('label.configure')}
                onClick={() => viewAppDetails(item)}
                appName={item.fullyQualifiedName ?? ''}
              />
            ))}
          </div>
        </Col>
        <Col span={24}>
          {showPagination(paging) && (
            <NextPrevious
              currentPage={currentPage}
              pageSize={pageSize}
              paging={paging}
              pagingHandler={handleBotPageChange}
              onShowSizeChange={handlePageSizeChange}
            />
          )}
        </Col>
      </Row>
    </>
  );
};

export default ApplicationPage;
