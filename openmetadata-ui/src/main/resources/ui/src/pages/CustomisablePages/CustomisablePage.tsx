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
import { Button, Col, Row, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { startCase } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import CustomizeMyData from '../../components/CustomizableComponents/CustomizeMyData/CustomizeMyData';
import Loader from '../../components/Loader/Loader';
import { LANDING_PAGE_LAYOUT } from '../../constants/CustomisePage.constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { ClientErrors } from '../../enums/axios.enum';
import { EntityType } from '../../enums/entity.enum';
import { Document } from '../../generated/entity/docStore/document';
import { PageType } from '../../generated/system/ui/page';
import {
  createDocument,
  getDocumentByFQN,
  updateDocument,
} from '../../rest/DocStoreAPI';
import { getFinalLandingPage } from '../../utils/CustomizableLandingPageUtils';
import { getSettingPath } from '../../utils/RouterUtils';

export const CustomisablePage = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { fqn, pageFqn } = useParams<{ fqn: string; pageFqn: PageType }>();
  const [page, setPage] = useState<Document>({} as Document);
  const [editedPage, setEditedPage] = useState<Document>({} as Document);
  const [isLoading, setIsLoading] = useState(true);

  const handlePageDataChange = useCallback((newPageData: Document) => {
    setEditedPage(newPageData);
  }, []);

  const fetchDocument = async () => {
    const pageFQN = `${EntityType.PERSONA}.${fqn}.${EntityType.PAGE}.${pageFqn}`;
    try {
      setIsLoading(true);
      const pageData = await getDocumentByFQN(pageFQN);
      const finalPageData = getFinalLandingPage(pageData, true);

      setPage(finalPageData);
      setEditedPage(finalPageData);
    } catch (error) {
      if ((error as AxiosError).response?.status === ClientErrors.NOT_FOUND) {
        setPage(
          getFinalLandingPage(
            {
              name: `${fqn}${pageFqn}`,
              fullyQualifiedName: pageFQN,
              entityType: EntityType.PAGE,
              data: {
                page: {
                  layout: LANDING_PAGE_LAYOUT,
                },
              },
            },
            true
          )
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const pageRendered = useMemo(() => {
    if (pageFqn === PageType.LandingPage) {
      return (
        <CustomizeMyData
          handlePageDataChange={handlePageDataChange}
          initialPageData={page}
        />
      );
    }

    return null;
  }, [page, pageFqn]);

  const handleCancel = () => {
    history.push(
      getSettingPath(
        GlobalSettingsMenuCategory.OPEN_METADATA,
        GlobalSettingOptions.CUSTOMIZE_LANDING_PAGE
      )
    );
  };

  const handleSave = async () => {
    try {
      const finalPage = getFinalLandingPage(editedPage);

      if (page.id) {
        const jsonPatch = compare(page, finalPage);

        await updateDocument(page?.id ?? '', jsonPatch);
      } else {
        await createDocument(finalPage);
      }

      handleCancel();
    } catch {
      // Error
    }
  };

  useEffect(() => {
    fetchDocument();
  }, [fqn, pageFqn]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Row>
      <Col
        className="bg-white d-flex justify-between border-bottom p-sm"
        span={24}>
        <div className="d-flex gap-2 items-center">
          <Typography.Title className="m-0" level={5}>
            {t('label.customise') + ' ' + startCase(pageFqn) + ' '}
          </Typography.Title>
          <span className="text-body">({startCase(fqn)})</span>
        </div>
        <Space>
          <Button size="small" onClick={handleCancel}>
            {t('label.cancel')}
          </Button>
          <Button size="small" type="primary" onClick={handleSave}>
            {t('label.save')}
          </Button>
        </Space>
      </Col>
      <Col span={24}>{pageRendered}</Col>
    </Row>
  );
};
