import {
  FormattedDashboardData,
  FormattedGlossaryTermData,
  FormattedTableData,
  FormattedTeamsData,
  FormattedUsersData,
  FormattedTopicData,
  FormattedTagData,
  FormattedMLModelData,
  FormattedPipelineData,
} from 'Models';
import { SearchIndex } from '../enums/search.enum';

export type SearchSource =
  | FormattedTableData
  | FormattedUsersData
  | FormattedTeamsData
  | FormattedGlossaryTermData;

export interface SearchHit<T extends SearchSource> {
  _index?: string;
  _type?: string;
  _id?: string;
  _score?: number;
  _source: T;
}

export interface SearchRequest {
  from: number;
  size: number;
  searchIndex: string;
  query?: string;
  filters?: string;
  sortField?: string;
  sortOrder?: string;
  includeDeleted?: boolean;
  trackTotalHits?: boolean;
  elasticsearchFilter?: Record<string, unknown>;
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
  hits: {
    total: {
      value: number;
      relation?: string;
    };
    hits: Array<SearchHit<T>>;
  };
  aggregations: Record<string, Sterm>;
}

export type Sterm = {
  doc_count_error_upper_bound: number;
  sum_other_doc_count: number;
  buckets: Array<Bucket>;
};

export type AggregationType = {
  title: string;
  buckets: Array<Bucket>;
};

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
      _source: FormattedTableData;
    }
  | {
      _index: SearchIndex.DASHBOARD;
      _source: FormattedDashboardData;
    }
  | {
      _index: SearchIndex.TOPIC;
      _source: FormattedTopicData;
    }
  | {
      _index: SearchIndex.TAG;
      _source: FormattedTagData;
    }
  | {
      _index: SearchIndex.GLOSSARY;
      _source: FormattedGlossaryTermData;
    }
  | {
      _index: SearchIndex.MLMODEL;
      _source: FormattedMLModelData;
    }
  | {
      _index: SearchIndex.PIPELINE;
      _source: FormattedPipelineData;
    }
);
