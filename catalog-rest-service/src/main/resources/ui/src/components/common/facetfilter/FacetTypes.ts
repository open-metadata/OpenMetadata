import { AggregationType, FilterObject } from 'Models';

export type FacetProp = {
  aggregations: Array<AggregationType>;
  onSelectHandler: (
    checked: boolean,
    name: string,
    type: keyof FilterObject
  ) => void;
  filters: FilterObject;
};

export type FilterContainerProp = {
  name: string;
  count: number;
  onSelect: (checked: boolean, name: string, type: keyof FilterObject) => void;
  isSelected: boolean;
  type: keyof FilterObject;
};
