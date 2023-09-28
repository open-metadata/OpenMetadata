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
import { PagingHandlerParams } from 'components/common/next-previous/NextPrevious.interface';
import PageHeader from 'components/header/PageHeader.component';
import { INITIAL_PAGING_VALUE, pagingObject } from 'constants/constants';
import { PAGE_HEADERS } from 'constants/PageHeaders.constant';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApplicationList } from 'rest/applicationAPI';
import { ListStoredProcedureParams } from 'rest/storedProceduresAPI';
import { showErrorToast } from 'utils/ToastUtils';

const ApplicationPage = () => {
  const { t } = useTranslation();

  const [applicationData, setApplicationData] = useState({
    data: [],
    paging: pagingObject,
    isLoading: true,
    currentPage: INITIAL_PAGING_VALUE,
  });

  const fetchApplicationList = useCallback(
    async (params?: ListStoredProcedureParams) => {
      try {
        setApplicationData((prev) => ({ ...prev, isLoading: true }));

        const { data, paging } = await getApplicationList({
          fields: 'owner',
          ...params,
        });

        setApplicationData((prev) => ({ ...prev, data, paging }));
      } catch (err) {
        showErrorToast(error as AxiosError);
      } finally {
        setApplicationData((prev) => ({ ...prev, isLoading: false }));
      }
    },
    []
  );

  const applicationPagingHandler = useCallback(
    async ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (cursorType) {
        const pagingString = {
          [cursorType]: applicationData.paging[cursorType],
        };

        await fetchApplicationList(pagingString);

        setApplicationData((prev) => ({
          ...prev,
          currentPage: currentPage,
        }));
      }
    },
    [applicationData.paging]
  );

  const handleAddApplication = () => {
    // add application click
  };

  useEffect(() => {
    fetchApplicationList({ limit: 0 });
  }, []);

  return (
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
  );
};

export default ApplicationPage;
