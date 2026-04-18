import { EntityStatus } from 'generated/entity/data/glossaryTerm';
import {
  ChangeDescription,
  EntityReference,
} from 'generated/entity/type';
import { TagLabel } from 'generated/type/tagLabel';
import { Votes } from 'generated/type/votes';

export enum PageType {
  ARTICLE = 'Article',
  QUICK_LINK = 'QuickLink',
}

export interface Article {
  publicationDate: Date;
  relatedArticles: EntityReference[];
}

export interface QuickLink {
  url: string;
}

export interface KnowledgePage {
  id: string;
  name: string;
  fullyQualifiedName: string;
  displayName?: string;
  description?: string;
  version: number;
  updatedAt: number;
  updatedBy: string;
  href: string;
  changeDescription?: ChangeDescription;
  owners?: EntityReference[];
  reviewers?: EntityReference[];
  followers?: EntityReference[];
  votes?: Votes;
  tags?: TagLabel[];
  domains?: EntityReference[];
  dataProducts?: EntityReference[];
  pageType: PageType;
  page: Article | QuickLink;
  relatedEntities?: EntityReference[];
  editors?: EntityReference[];
  parent?: EntityReference;
  children?: EntityReference[];
  deleted: boolean;
  entityStatus?: EntityStatus;
}

export type CreateKnowledgePage = Pick<
  KnowledgePage,
  | 'name'
  | 'displayName'
  | 'description'
  | 'owners'
  | 'tags'
  | 'pageType'
  | 'page'
  | 'relatedEntities'
  | 'parent'
>;

export type KnowledgePagePutResponse = {
  entity: KnowledgePage;
};

export type RecentViewedKnowledgePage = KnowledgePage & { timestamp: number };

export interface RecentlyViewedQuickLinks {
  data: RecentViewedKnowledgePage[];
}

export enum ContentChangeState {
  SAVED = 'Saved',
  UN_SAVED = 'Unsaved',
  SAVING = 'Saving',
}

export interface PageHierarchy {
  id: string;
  name: string;
  fullyQualifiedName: string;
  displayName?: string;
  description?: string;
  pageType: PageType;
  children?: PageHierarchy[];
  childrenCount: number;
}

export interface PageSearchResult {
  parent?: PageHierarchy;
  page?: PageHierarchy;
}

export interface MovedEntity {
  sourceNode: PageHierarchy;
  targetNode?: PageHierarchy;
  sourceNodeParent?: PageHierarchy;
}

export interface KnowledgeCenterPageProps {
  title: string;
  rightPanel: React.ReactNode;
  header: React.ReactNode;
  data?: KnowledgePage;
  activeTab?: string;
}

export interface KnowledgeCenterPageRef {
  onPageDelete: (id: string | string[]) => void;
  addKnowledgePage: (knowledgePage: KnowledgePage) => void;
}

export interface KnowledgePagesHierarchyRef {
  fetchKnowledgePageHierarchy: (forceRefresh?: boolean) => Promise<void>;
}

export interface KnowledgePageHierarchyResponse {
  data: PageHierarchy[];
  paging: {
    total: number;
    offset: number;
    limit: number;
  };
}
