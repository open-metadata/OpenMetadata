export const getFilterString = (filters, excludeFilters = []) => {
  const modifiedFilters = {};
  for (const key in filters) {
    if (excludeFilters.includes(key)) {
      continue;
    }
    const modifiedFilter = [];
    const filter = filters[key];
    filter.forEach((value) => {
      modifiedFilter.push(`${key.split(' ').join('_')}:${value}`);
    });
    modifiedFilters[key] = modifiedFilter;
  }
  const filterString = Object.values(modifiedFilters)
    .filter((value) => value.length)
    .map((filters) => `(${filters.join(' OR ')})`);

  return filterString.join(' AND ');
};
