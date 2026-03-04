CREATE TABLE IF NOT EXISTS {catalog}.{schema}.{table_name} (
    promotiontransactionid BIGINT,
    validto TIMESTAMP,
    vouchercode VARCHAR,
    payload ROW(
        id VARCHAR,
        amount DOUBLE,
        currency VARCHAR,
        metadata MAP(VARCHAR, VARCHAR),
        items ARRAY(ROW(
            itemId VARCHAR,
            quantity INTEGER,
            price DOUBLE
        ))
    ),
    adjustmenthistory ARRAY(ROW(
        adjustmentId VARCHAR,
        timestamp TIMESTAMP,
        amount DOUBLE,
        reason VARCHAR
    )),
    simplemap MAP(VARCHAR, VARCHAR),
    simplearray ARRAY(VARCHAR)
);

INSERT INTO {catalog}.{schema}.{table_name} VALUES
(
    1001,
    TIMESTAMP '2024-12-31 23:59:59',
    'PROMO2024',
    ROW(
        'txn_001',
        99.99,
        'USD',
        MAP(ARRAY['store', 'region'], ARRAY['Store123', 'US-West']),
        ARRAY[
            ROW('item_001', 2, 29.99),
            ROW('item_002', 1, 40.01)
        ]
    ),
    ARRAY[
        ROW('adj_001', TIMESTAMP '2024-01-15 10:30:00', -5.00, 'Discount'),
        ROW('adj_002', TIMESTAMP '2024-01-15 11:00:00', 2.50, 'Tax adjustment')
    ],
    MAP(ARRAY['status', 'type'], ARRAY['active', 'promotion']),
    ARRAY['tag1', 'tag2', 'tag3']
),
(
    1002,
    TIMESTAMP '2024-06-30 23:59:59',
    'SUMMER2024',
    ROW(
        'txn_002',
        150.75,
        'EUR',
        MAP(ARRAY['campaign', 'channel'], ARRAY['Summer Sale', 'Online']),
        ARRAY[
            ROW('item_003', 3, 45.25),
            ROW('item_004', 1, 15.00)
        ]
    ),
    ARRAY[
        ROW('adj_003', TIMESTAMP '2024-02-20 14:15:00', -10.00, 'Coupon')
    ],
    MAP(ARRAY['status', 'priority'], ARRAY['completed', 'high']),
    ARRAY['summer', 'sale', 'online']
)
