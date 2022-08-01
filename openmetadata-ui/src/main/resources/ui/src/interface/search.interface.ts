import { FormattedGlossaryTermData } from 'Models';
import { SearchIndex } from '../enums/search.enum';
import { Table } from '../generated/entity/data/table';
import { User } from '../generated/entity/teams/user';
import { Dashboard } from '../generated/entity/data/dashboard';
import { Mlmodel } from '../generated/entity/data/mlmodel';
import { Pipeline } from '../generated/entity/data/pipeline';
import { TagLabel } from '../generated/type/tagLabel';
import { Team } from '../generated/entity/teams/team';
import { Topic } from '../generated/entity/data/topic';

interface SearchSourceBase {
  tier?: TagLabel;
  entityType: string;
}

export interface TableSearchSource extends SearchSourceBase, Table {}

export interface DashboardSearchSource extends SearchSourceBase, Dashboard {}

export interface PipelineSearchSource extends SearchSourceBase, Pipeline {}

export interface MlmodelSearchSource extends SearchSourceBase, Mlmodel {}

export interface TopicSearchSource extends SearchSourceBase, Topic {}

export type SearchSource =
  | TableSearchSource
  | User
  | DashboardSearchSource
  | MlmodelSearchSource
  | PipelineSearchSource
  | TagLabel
  | Team
  | TopicSearchSource
  | FormattedGlossaryTermData;

export type ExploreSearchSource =
  | TableSearchSource
  | DashboardSearchSource
  | MlmodelSearchSource
  | TopicSearchSource
  | PipelineSearchSource;

export interface SearchHit<T> {
  _index: SearchIndex;
  _type?: string;
  _id?: string;
  _score?: number;
  highlight?: Record<string, string[]>;
  sort?: number[];
  _source: T;
}

export interface SearchRequest {
  from: number;
  size: number;
  searchIndex: string;
  query?: string;
  queryFilter?: Record<string, unknown>;
  postFilter?: Record<string, unknown>;
  sortField?: string;
  sortOrder?: string;
  includeDeleted?: boolean;
  trackTotalHits?: boolean;
  includeFields?: string[];
  excludeFields?: string[];
  fetchSource?: boolean;
}

export interface SuggestRequest {
  query: string;
  searchIndex: string;
  field?: string;
  fetchSource?: boolean;
  includeSourceFields?: string[];
  excludeSourceFields?: string[];
}

export interface SearchResponse<T extends SearchSource> {
  took?: number;
  timed_out?: boolean;
  hits: {
    total: {
      value: number;
      relation?: string;
    };
    hits: SearchHit<T>[];
  };
  aggregations?: Aggregations;
}

export type Aggregations = Record<string, { buckets: Bucket[] }>;

export type Bucket = {
  key: string;
  doc_count: number;
};

export type SuggestionProp = {
  searchText: string;
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
};

export type SuggestOption = {
  text: string;
} & (
  | {
      _index: SearchIndex.TABLE;
      _source: TableSearchSource;
    }
  | {
      _index: SearchIndex.DASHBOARD;
      _source: DashboardSearchSource;
    }
  | {
      _index: SearchIndex.TOPIC;
      _source: TopicSearchSource;
    }
  | {
      _index: SearchIndex.TAG;
      _source: TagLabel;
    }
  | {
      _index: SearchIndex.GLOSSARY;
      _source: FormattedGlossaryTermData;
    }
  | {
      _index: SearchIndex.MLMODEL;
      _source: MlmodelSearchSource;
    }
  | {
      _index: SearchIndex.PIPELINE;
      _source: PipelineSearchSource;
    }
);
