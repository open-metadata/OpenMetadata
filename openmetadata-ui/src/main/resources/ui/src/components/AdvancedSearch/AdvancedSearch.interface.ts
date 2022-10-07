import { JsonTree } from 'react-awesome-query-builder';
import { SearchIndex } from '../../enums/search.enum';

export interface AdvancedSearchProps {
  jsonTree: JsonTree | undefined;
  searchIndex: SearchIndex;
  onChangeJsonTree: (tree: JsonTree) => void;
  onChangeQueryFilter: (
    queryFilter: Record<string, unknown> | undefined
  ) => void;
}

export type FilterObject = Record<string, string[]>;

export function isFilterObject(obj: unknown): obj is FilterObject {
  const typedObj = obj as FilterObject;

  return (
    ((typedObj !== null && typeof typedObj === 'object') ||
      typeof typedObj === 'function') &&
    Object.entries<unknown>(typedObj).every(
      ([key, value]) =>
        Array.isArray(value) &&
        value.every((e: unknown) => typeof e === 'string') &&
        typeof key === 'string'
    )
  );
}
