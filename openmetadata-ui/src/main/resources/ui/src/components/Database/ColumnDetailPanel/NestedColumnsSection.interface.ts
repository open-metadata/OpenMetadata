import { Column } from '../../../generated/entity/data/table';

export interface NestedColumnsSectionProps {
    columns: Column[];
    onColumnClick: (column: Column) => void;
  }