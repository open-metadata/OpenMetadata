CREATE TABLE IF NOT EXISTS {catalog}.{schema}.{table_name} (
    payload ROW(
        foobar VARCHAR,
        foobaz DOUBLE,
        foos ARRAY(ROW(bars VARCHAR))
    ),
    foobars ARRAY(VARCHAR)
);

INSERT INTO {catalog}.{schema}.{table_name} VALUES
(
    ROW(
        'test_value',
        123.45,
        ARRAY[ROW('bar1'), ROW('bar2')]
    ),
    ARRAY['foo1', 'foo2', 'foo3']
),
(
    ROW(
        'another_value',
        678.90,
        ARRAY[ROW('bar3')]
    ),
    ARRAY['foo4']
);
