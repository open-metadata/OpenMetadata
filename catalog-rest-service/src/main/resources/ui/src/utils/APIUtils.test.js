const APIHits = [
  {
    _source: {
      description: 'this is the table to hold data on dim_shop',
      fqdn: 'hive.dim_shop',
      tableName: 'dim_shop',
      tableId: 'd2b34d55-8cc5-4a7e-9064-04dd37ef27b8',
      tableType: 'REGULAR',
    },
  },
];
const formatDataResponse = jest.fn().mockImplementation((hist) => {
  const formatedData = hist.map((hit) => {
    const newData = {};
    newData.id = hit._source.tableId;
    newData.name = hit._source.tableName;
    newData.description = hit._source.description;
    newData.fullyQualifiedName = hit._source.fqdn;
    newData.tableType = hit._source.tableType;

    return newData;
  });

  return formatedData;
});

describe('Test APIUtils utility', () => {
  it('Returns the proper formatted data', () => {
    const formattedData = formatDataResponse(APIHits);

    expect(formattedData).toStrictEqual([
      {
        fullyQualifiedName: 'hive.dim_shop',
        description: 'this is the table to hold data on dim_shop',
        name: 'dim_shop',
        id: 'd2b34d55-8cc5-4a7e-9064-04dd37ef27b8',
        tableType: 'REGULAR',
      },
    ]);
  });
});
