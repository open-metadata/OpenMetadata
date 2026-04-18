import { Col, Row, Typography } from 'antd';
import { ReactComponent as IconArticle } from 'assets/svg/ic-articles.svg';
import { ReactComponent as LinkIcon } from 'assets/svg/ic-link.svg';
import classNames from 'classnames';
import { ROUTES } from 'constants/constants';
import { DetailPageWidgetKeys } from 'enums/CustomizeDetailPage.enum';
import {
  KnowledgePage,
  PageType,
  QuickLink,
} from 'interface/knowledge-center.interface';
import { isEmpty, map } from 'lodash';
import ExpandableCard from 'components/common/ExpandableCard/ExpandableCard';
import Loader from 'components/common/Loader/Loader';
import { useGenericContext } from 'components/Customization/GenericProvider/GenericProvider';
import { PAGE_SIZE } from 'constants/constants';
import { Paging } from 'generated/type/paging';
import { getEntityName } from 'utils/EntityUtils';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getListKnowledgePages } from 'rest/knowledgeCenterAPI';
import { getKnowledgePagePath } from 'utils/KnowledgePageUtils';

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

  const header = (
    <div className="d-flex justify-between">
      <Typography.Text
        className="text-sm font-medium"
        data-testid="header-label">
        {t('label.knowledge-center')}
      </Typography.Text>
      {/* only show view all if length is greater than PAGE_SIZE i.e 10 */}
      {paging?.total > PAGE_SIZE && (
        <Link
          data-testid="view-all-data-asset-related-articles"
          to={`${ROUTES.KNOWLEDGE_CENTER_FILTER}?entityId=${entityId}&entityType=${entityType}`}>
          {t('label.view-all')}
        </Link>
      )}
    </div>
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
                    height={12}
                    style={{ verticalAlign: 'middle' }}
                    width={12}
                  />
                ) : (
                  <IconArticle
                    data-testid="article-icon"
                    height={12}
                    style={{ verticalAlign: 'middle' }}
                    width={12}
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
                        pathname: getKnowledgePagePath(
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
    <ExpandableCard
      cardProps={{
        title: header,
      }}
      dataTestId="knowledge-center">
      {content}
    </ExpandableCard>
  );
};

export default KnowledgePages;
