/*
 *  Copyright 2026 Collate.
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
import { Col, Row, Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty, map } from 'lodash';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconArticle } from '../../../assets/svg/common/file.svg';
import { ReactComponent as LinkIcon } from '../../../assets/svg/quick-link.svg';
import Loader from '../../../components/common/Loader/Loader';
import WidgetCard from '../../../components/common/WidgetCard/WidgetCard';
import { useGenericContext } from '../../../components/Customization/GenericProvider/GenericContext';
import { PAGE_SIZE, ROUTES } from '../../../constants/constants';
import { DetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { Paging } from '../../../generated/type/paging';
import {
  KnowledgePage,
  PageType,
  QuickLink,
} from '../../../interface/knowledge-center.interface';
import { getListKnowledgePages } from '../../../rest/knowledgeCenterAPI';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { getEntityName } from '../../../utils/EntityNameUtils';

const KnowledgePages: FC = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [knowledgePages, setKnowledgePages] = useState<KnowledgePage[]>([]);
  const [paging, setPaging] = useState<Paging>({ total: 0 });
  const {
    data: { id: entityId = '' } = {},
    type: entityType,
    filterWidgets,
  } = useGenericContext();

  const fetchKnowledgePages = async () => {
    setIsLoading(true);
    try {
      const { data, paging } = await getListKnowledgePages({
        entityId,
        entityType,
      });
      setKnowledgePages(data);
      setPaging(paging);
    } catch {
      // we will not throw error toast here
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (entityId && entityType) {
      fetchKnowledgePages();
    } else {
      setIsLoading(false);
    }
  }, [entityId, entityType]);

  // only show view all if length is greater than PAGE_SIZE i.e 10
  const headerExtra = paging?.total > PAGE_SIZE && (
    <Link
      data-testid="view-all-data-asset-related-articles"
      to={`${ROUTES.CONTEXT_CENTER_FILTER}?entityId=${entityId}&entityType=${entityType}`}>
      {t('label.view-all')}
    </Link>
  );

  const content = (
    <div
      className="entity-list-body article-list"
      data-testid="knowledge-pages">
      {map(knowledgePages, (knowledgePage, index) => {
        const isQuickLink = knowledgePage.pageType === PageType.QUICK_LINK;
        const quickLink = knowledgePage.page as QuickLink;

        return (
          <Row
            className={classNames({
              'm-b-sm': knowledgePages.length - 1 !== index,
            })}
            data-testid="article-entry"
            gutter={[0, 4]}
            key={knowledgePage.id}>
            <Col className="d-flex items-center gap-2" span={24}>
              <span>
                {isQuickLink ? (
                  <LinkIcon
                    data-testid="link-icon"
                    height={16}
                    style={{ verticalAlign: 'middle' }}
                    width={16}
                  />
                ) : (
                  <IconArticle
                    data-testid="article-icon"
                    height={16}
                    style={{ verticalAlign: 'middle' }}
                    width={16}
                  />
                )}
              </span>
              <Link
                className="no-underline w-max-95 truncate"
                data-testid="page-link"
                target={isQuickLink ? '_blank' : '_self'}
                to={
                  isQuickLink
                    ? quickLink.url
                    : {
                        pathname: contextCenterClassBase.getArticlePath(
                          knowledgePage.fullyQualifiedName
                        ),
                      }
                }>
                <Typography.Text
                  className="article-header"
                  ellipsis={{ tooltip: true }}>
                  {getEntityName(knowledgePage)}
                </Typography.Text>
              </Link>
            </Col>
          </Row>
        );
      })}
    </div>
  );

  useEffect(() => {
    if (!isLoading && isEmpty(knowledgePages)) {
      filterWidgets?.([DetailPageWidgetKeys.KNOWLEDGE_ARTICLE]);
    }
  }, [isLoading, knowledgePages]);

  if (isLoading) {
    return <Loader />;
  }

  if (!isLoading && isEmpty(knowledgePages)) {
    return null;
  }

  return (
    <WidgetCard
      dataTestId="knowledge-center"
      headerExtra={headerExtra}
      title={t('label.knowledge-center')}>
      {content}
    </WidgetCard>
  );
};

export default KnowledgePages;
