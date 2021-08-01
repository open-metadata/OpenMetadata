export const mockData = [
  {
    dataId: 1,
    dataName: 'hourly_sales_figures',
    likeCount: '487',
    description: 'Report of hourly sales figures in the market place',
    miscDetails: [
      {
        key: 'Owner',
        value: 'Shops Org',
      },
      {
        key: 'Time taken to run',
        value: '5mins 30secs',
      },
      {
        key: 'Cost',
        value: '$45',
      },
    ],
    query:
      'SELECT order_id, api_client_id, billing_address_id, customer_id, location_id, shipping_address_id, shop_id, user_id, name,',
  },
  {
    dataId: 2,
    dataName: 'non_checked_out_shopping_carts',
    likeCount: '234',
    description:
      'Analyze how many shopping carts are left over and not checked out by the users',
    miscDetails: [
      {
        key: 'Owner',
        value: 'Shops Org',
      },
      {
        key: 'Time taken to run',
        value: '5mins 30secs',
      },
      {
        key: 'Cost',
        value: '$45',
      },
    ],
    query: "SELECT * FROM Customers WHERE Country='Mexico'",
  },
  {
    dataId: 3,
    dataName: 'top_selling_products',
    likeCount: '846',
    description:
      'Report of the top selling products by category across the market place',
    miscDetails: [
      {
        key: 'Owner',
        value: 'Shops Org',
      },
      {
        key: 'Time taken to run',
        value: '5mins 30secs',
      },
      {
        key: 'Cost',
        value: '$45',
      },
    ],
    query:
      'SELECT Orders.OrderID, Customers.CustomerName, Orders.OrderDate FROM Orders INNER JOIN Customers ON Orders.CustomerID=Customers.CustomerID;',
  },
];

export const reportDetails = {
  dataId: 1,
  dataName: 'hourly_sales_figures',
  likeCount: '487',
  description: 'Report of hourly sales figures in the market place',
  miscDetails: [
    {
      key: 'Owner',
      value: 'Shops Org',
    },
    {
      key: 'Time taken to run',
      value: '5mins 30secs',
    },
    {
      key: 'Cost',
      value: '$45',
    },
  ],
  query:
    'SELECT order_id, api_client_id, billing_address_id, customer_id, location_id, shipping_address_id, shop_id, user_id, name,',
};
