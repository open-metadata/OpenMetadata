CREATE TABLE test_check (foo INT, bar STRING);
LOAD DATA LOCAL INPATH '/opt/hive/examples/files/kv1.txt' OVERWRITE INTO TABLE test_check;
CREATE TABLE `metadata_test_table` (foo INT, bar STRING);
CREATE TABLE metadata_struct_test
(
 test_id INT,
 service STRUCT<
                type: STRING
               ,provider: ARRAY<INT>
               >
);

CREATE TABLE metadata_array_struct_test
(
 test_id INT,
 service array<STRUCT<
                type: STRING
               ,provider: ARRAY<INT>
               >>
);

WITH
test_data as (
    SELECT 100 test_id, array(NAMED_STRUCT('type','Logistics','provider', ARRAY(550, 870)),
                      NAMED_STRUCT('type','Inventory','provider', ARRAY(900`))
                      ) AS service
)
INSERT INTO TABLE metadata_array_struct_test
select * from test_data;
CREATE TABLE union_test(foo UNIONTYPE<int, double, array<string>, struct<a:int,b:string>>);