import { Table, TableType } from '../../../generated/entity/data/table';
import { OverallTableSummeryType } from '../../TableProfiler/TableProfiler.interface';

export interface EntitySummaryPanelProps {
  entityDetails: Table;
  handleClosePanel: () => void;
  overallSummery: OverallTableSummeryType[];
  showPanel: boolean;
}

export interface BasicTableInfo {
  Type: TableType | string;
  Queries: string;
  Columns: string;
}
