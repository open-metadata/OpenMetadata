export const getSearchAPIQuery = (
  queryString: string,
  from: number,
  size: number,
  filters: string,
  sortField: string,
  sortOrder: string,
  searchIndex: string
): string => {
  const start = (from - 1) * size;
  const query = queryString ? `*${queryString}*` : '*';

  return `q=${query}${
    filters ? ` AND ${filters}` : ''
  }&from=${start}&size=${size}${sortField ? `&sort_field=${sortField}` : ''}${
    sortOrder ? `&sort_order=${sortOrder}` : ''
  }${searchIndex ? `&index=${searchIndex}` : ''}`;
};
