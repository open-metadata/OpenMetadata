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
import Icon from '@ant-design/icons';
import { Col, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, map } from 'lodash';
import { ReactComponent as KnowledgeCenterNoDataPlaceholder } from 'assets/svg/no-folder-data.svg';
import WidgetEmptyState from 'components/MyData/Widgets/Common/WidgetEmptyState/WidgetEmptyState';
import WidgetFooter from 'components/MyData/Widgets/Common/WidgetFooter/WidgetFooter';
import WidgetHeader from 'components/MyData/Widgets/Common/WidgetHeader/WidgetHeader';
import WidgetWrapper from 'components/MyData/Widgets/Common/WidgetWrapper/WidgetWrapper';
import { PAGE_SIZE_MEDIUM } from 'constants/constants';
import { SIZE } from 'enums/common.enum';
import { EntityType } from 'enums/entity.enum';
import { useApplicationStore } from 'hooks/useApplicationStore';
import { WidgetCommonProps } from 'pages/CustomizablePage/CustomizablePage.interface';
import { getEntityName } from 'utils/EntityUtils';
import { showErrorToast } from 'utils/ToastUtils';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as IconArticle } from '../../../assets/svg/ic-article.svg';
import { ReactComponent as KnowledgeCenterWidgetIcon } from '../../../assets/svg/ic-knowledge-center-widget.svg';
import { ReactComponent as LinkIcon } from '../../../assets/svg/ic-quick-link.svg';
import {
  KnowledgePage,
  PageType,
  QuickLink,
} from '../../../interface/knowledge-center.interface';
import { getListKnowledgePages } from '../../../rest/knowledgeCenterAPI';
import { t } from '../../../utils/i18next/LocalUtil';
import { getKnowledgePagePath } from '../../../utils/KnowledgePageUtils';
import './KnowledgeCenterWidget.less';

import { ROUTES } from 'constants/constants';
const KnowledgeCenterWidget = ({
  isEditView = false,
  widgetKey,
  handleRemoveWidget,
  currentLayout,
  handleLayoutUpdate,
}: WidgetCommonProps) => {
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [data, setData] = useState<KnowledgePage[]>([]);

  const widgetData = useMemo(() => {
    return currentLayout?.find((item) => item.i === widgetKey);
  }, [currentLayout, widgetKey]);

  const isFullSizeWidget = useMemo(() => {
    return currentLayout?.find((layout) => layout.i === widgetKey)?.w === 2;
  }, [currentLayout, widgetKey]);

  const fetchUserKnowledgeArticles = async () => {
    if (!currentUser?.id) {
      return;
    }

    setIsLoading(true);
    try {
      const { data: responseData } = await getListKnowledgePages({
        entityId: currentUser.id,
        entityType: EntityType.USER,
        limit: PAGE_SIZE_MEDIUM,
      });
      setData(responseData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const emptyState = useMemo(() => {
    return (
      <WidgetEmptyState
        actionButtonLink={ROUTES.KNOWLEDGE_CENTER}
        actionButtonText={t('label.create-articles')}
        description={t('message.no-article-data')}
        icon={
          <KnowledgeCenterNoDataPlaceholder
            height={SIZE.MEDIUM}
            width={SIZE.MEDIUM}
          />
        }
        title={t('label.no-knowledge-articles-available')}
      />
    );
  }, [t]);

  const getGridTemplateColumns = () => {
    if (isFullSizeWidget) {
      return 'repeat(3, 1fr)';
    }

    return 'repeat(1, 1fr)';
  };

  const articlesContent = useMemo(() => {
    return (
      <div className="entity-list-body">
        <div
          className={classNames('cards-scroll-container')}
          style={{ gridTemplateColumns: getGridTemplateColumns() }}>
          {map(data, (knowledgePage) => {
            const isQuickLink = knowledgePage.pageType === PageType.QUICK_LINK;
            const quickLink = knowledgePage.page as QuickLink;

            return (
              <Row
                className="article-entry"
                data-testid="article-entry"
                key={knowledgePage.id}>
                <Col className="d-flex items-center gap-2" span={24}>
                  <span>
                    <Icon
                      className="knowledge-icon d-flex align-items-center justify-center"
                      component={isQuickLink ? LinkIcon : IconArticle}
                      data-testid={`${
                        isQuickLink ? 'link-icon' : 'article-icon'
                      }`}
                    />
                  </span>
                  <Link
                    className="no-underline w-full"
                    data-testid={`${
                      isQuickLink ? 'quick-link' : 'knowledge-page'
                    }-link`}
                    target={isQuickLink ? '_blank' : '_self'}
                    to={
                      isQuickLink
                        ? quickLink.url
                        : {
                            pathname: getKnowledgePagePath(
                              knowledgePage.fullyQualifiedName
                            ),
                          }
                    }>
                    <Typography.Text
                      className="article-header text-sm font-regular text-left cursor-pointer ellipsis-text"
                      ellipsis={{ tooltip: true }}>
                      {getEntityName(knowledgePage)}
                    </Typography.Text>
                  </Link>
                </Col>
              </Row>
            );
          })}
        </div>
      </div>
    );
  }, [data, isFullSizeWidget]);

  const showWidgetFooterMoreButton = useMemo(
    () => Boolean(!isLoading) && data?.length > 10,
    [data, isLoading]
  );

  const footer = useMemo(() => {
    return (
      <WidgetFooter
        moreButtonLink={ROUTES.KNOWLEDGE_CENTER}
        moreButtonText={t('label.view-more')}
        showMoreButton={showWidgetFooterMoreButton}
      />
    );
  }, [isLoading]);

  const widgetHeader = useMemo(() => {
    return (
      <WidgetHeader
        className="items-center"
        currentLayout={currentLayout}
        handleLayoutUpdate={handleLayoutUpdate}
        handleRemoveWidget={handleRemoveWidget}
        icon={<KnowledgeCenterWidgetIcon height={22} width={22} />}
        isEditView={isEditView}
        title={t('label.knowledge-center')}
        widgetKey={widgetKey}
        onTitleClick={() => navigate(ROUTES.KNOWLEDGE_CENTER)}
      />
    );
  }, [
    currentLayout,
    handleLayoutUpdate,
    handleRemoveWidget,
    isEditView,
    widgetKey,
    widgetData?.w,
  ]);

  useEffect(() => {
    fetchUserKnowledgeArticles();
  }, [currentUser]);

  return (
    <WidgetWrapper
      dataLength={!isEmpty(data) ? data.length : 10}
      dataTestId="KnowledgePanel.KnowledgeCenter"
      header={widgetHeader}
      loading={isLoading}>
      <div className="knowledge-center-widget-container d-flex flex-column h-full">
        <div className="widget-content flex-1 knowledge-center-widget h-full">
          {isEmpty(data) ? emptyState : articlesContent}
        </div>
        {!isEmpty(data) && !isFullSizeWidget && footer}
      </div>
    </WidgetWrapper>
  );
};

export default KnowledgeCenterWidget;
