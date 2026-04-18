import { ReactComponent as IconArticle } from 'assets/svg/ic-articles.svg';
import { ReactComponent as LinkIcon } from 'assets/svg/ic-link.svg';
import KnowledgePageSummary from 'components/KnowledgeCenter/KnowledgePageSummary/KnowledgePageSummary';
import { KnowledgePage, PageType } from 'interface/knowledge-center.interface';

export const getPageIcon = (pageType: PageType) => {
  const isQuickLink = pageType === PageType.QUICK_LINK;

  return isQuickLink ? <LinkIcon width={28} /> : <IconArticle width={28} />;
};

export const getPageSummaryComponent = (entity: KnowledgePage) => {
  return <KnowledgePageSummary entityDetails={entity} />;
};
