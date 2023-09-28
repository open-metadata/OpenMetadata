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
import Loader from 'components/Loader/Loader';
import { EntityType } from 'enums/entity.enum';
import { EntityReference } from 'generated/entity/type';
import { Page, PageType } from 'generated/system/ui/page';
import { startCase } from 'lodash';
import MyDataPageV1 from 'pages/MyDataPage/MyDataPageV1.component';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { createPage, getPageDetails } from 'rest/PageAPI';

export const CustomisablePage = () => {
  const { fqn, pageFqn } = useParams<{ fqn: string; pageFqn: PageType }>();

  const [page, setPage] = useState<Page>();
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();

  const fetchDocument = async () => {
    try {
      setIsLoading(true);
      const page = await getPageDetails(fqn, pageFqn);

      setPage(page);
    } catch (error) {
      // Error
    } finally {
      setIsLoading(false);
    }
  };

  const pageRendered = useMemo(() => {
    switch (pageFqn) {
      case PageType.LandingPage:
        return <MyDataPageV1 />;
    }

    return null;
  }, [pageFqn]);

  useEffect(() => {
    fetchDocument();
  }, [fqn, pageFqn]);

  const handleSave = async () => {
    const pageData = {
      pageType: pageFqn,
      knowledgePanels: [
        {
          name: 'KnowledgePanel.AvtivityFeed',
          type: EntityType.knowledgePanels,
        },
        {
          name: 'KnowledgePanel.MyData',
          type: EntityType.knowledgePanels,
        },
        {
          name: 'KnowledgePanel.KPI',
          type: EntityType.knowledgePanels,
        },

        {
          name: 'KnowledgePanel.TotalDataAssets',
          type: EntityType.knowledgePanels,
        },
      ],
      name: pageFqn,
      persona: { name: fqn, type: EntityType.PERSONA } as EntityReference,
      fullyQualifiedName: `${EntityType.PERSONA}.${fqn}.${EntityType.PAGE}.${pageFqn}`,
      entityType: EntityType.PAGE,
      layout: [
        {
          w: 9,
          h: 4,
          x: 0,
          y: 0,
          i: 'FeedsWidget',
          moved: false,
          static: false,
        },
        {
          w: 3,
          h: 2,
          x: 0,
          y: 4,
          i: 'MyDataWidget',
          moved: false,
          static: false,
        },
        {
          w: 6,
          h: 2,
          x: 3,
          y: 4,
          i: 'KPIWidget',
          moved: false,
          static: false,
        },
        {
          w: 9,
          h: 2.2,
          x: 0,
          y: 6,
          i: 'TotalDataAssetsWidget',
          moved: false,
          static: false,
        },
        {
          w: 3,
          h: 9,
          x: 9,
          y: 0,
          i: 'RightSidebar',
          moved: false,
          static: true,
        },
      ],
    };
    await createPage(pageData as unknown as Page);
  };

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
          <Button size="small">{t('label.cancel')}</Button>
          <Button size="small" type="primary" onClick={handleSave}>
            {t('label.save')}
          </Button>
        </Space>
      </Col>
      <Col>{pageRendered}</Col>
    </Row>
  );
};
