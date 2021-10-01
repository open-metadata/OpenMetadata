import { Column, Table } from '../../generated/entity/data/table';

const makeRow = (column: Column) => {
  return {
    description: column.description || '',
    tags: column?.tags || [],
    ...column,
  };
};

export const makeData = (
  columns: Table['columns'] = []
): Array<Column & { subRows: Column[] | undefined }> => {
  const data = columns.map((column) => ({
    ...makeRow(column),
    subRows: column.children ? makeData(column.children) : undefined,
  }));

  return data;
};
