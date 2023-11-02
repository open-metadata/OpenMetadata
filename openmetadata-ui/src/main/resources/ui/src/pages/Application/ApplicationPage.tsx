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
import { Button, Card, Col, Row, Skeleton } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, uniqueId } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import ApplicationCard from '../../components/Applications/ApplicationCard/ApplicationCard.component';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import NextPrevious from '../../components/common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import { ROUTES } from '../../constants/constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { App } from '../../generated/entity/applications/app';
import { Paging } from '../../generated/type/paging';
import { usePaging } from '../../hooks/paging/usePaging';
import { getApplicationList } from '../../rest/applicationAPI';
import { getEntityName } from '../../utils/EntityUtils';
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

  const errorPlaceHolder = useMemo(
    () => (
      <Col className="mt-24 text-center" span={24}>
        <ErrorPlaceHolder
          heading={t('label.application-plural')}
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          <div>{t('message.no-installed-applications-found')}</div>
        </ErrorPlaceHolder>
      </Col>
    ),
    []
  );

  useEffect(() => {
    fetchApplicationList();
  }, []);

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
        {isLoading &&
          [1, 2].map((key) => (
            <Col key={key} span={12}>
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
                  pagingHandler={handleBotPageChange}
                  onShowSizeChange={handlePageSizeChange}
                />
              )}
            </Col>
          </>
        )}
      </Row>
    </>
  );
};

export default ApplicationPage;
