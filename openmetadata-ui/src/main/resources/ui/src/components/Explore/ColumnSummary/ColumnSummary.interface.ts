import { Column, DataType } from '../../../generated/entity/data/table';
import { TagLabel } from './../../../generated/type/tagLabel';

export interface ColumnSummaryProps {
  columns: Column[];
}

export interface BasicColumnInfo {
  name: string;
  type: DataType;
  tags?: TagLabel[];
  description?: string;
}
