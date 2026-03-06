#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Tests for Glue PySpark/GlueContext script lineage parser
"""
from unittest import TestCase

from metadata.ingestion.source.pipeline.gluepipeline.script_parser import (
    CatalogRef,
    JDBCRef,
    parse_glue_script,
)


class TestGlueScriptParser(TestCase):
    def test_empty_script(self):
        result = parse_glue_script("")
        self.assertFalse(result.has_lineage)

    def test_none_script(self):
        result = parse_glue_script(None)
        self.assertFalse(result.has_lineage)

    def test_from_options_s3_source(self):
        script = '''
s3_df = glueContext.create_dynamic_frame.from_options(
    connection_type="s3",
    format="parquet",
    connection_options={
        "paths": ["s3://collate-glue-connector-test/glue-sample-data/parquet/"],
        "recurse": True
    },
    transformation_ctx="s3_df"
)
'''
        result = parse_glue_script(script)
        self.assertTrue(result.has_lineage)
        self.assertIn(
            "s3://collate-glue-connector-test/glue-sample-data/parquet/",
            result.s3_sources,
        )

    def test_write_jdbc_conf_target(self):
        script = '''
glueContext.write_dynamic_frame.from_jdbc_conf(
    frame=s3_df,
    catalog_connection="Redshift - Jdbc connection",
    connection_options={
        "database": "dev",
        "dbtable": "customer_sample"
    },
    redshift_tmp_dir="s3://collate-glue-connector-test/temp/",
    transformation_ctx="jdbc_sink"
)
'''
        result = parse_glue_script(script)
        self.assertTrue(result.has_lineage)
        self.assertEqual(len(result.jdbc_targets), 1)
        self.assertEqual(result.jdbc_targets[0].connection_name, "Redshift - Jdbc connection")
        self.assertEqual(result.jdbc_targets[0].table, "customer_sample")
        self.assertEqual(result.jdbc_targets[0].database, "dev")

    def test_full_user_script(self):
        script = '''
import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job

args = getResolvedOptions(sys.argv, ['JOB_NAME'])

sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session

job = Job(glueContext)
job.init(args['JOB_NAME'], args)

# ---------- READ FROM S3 (PARQUET) ----------
s3_df = glueContext.create_dynamic_frame.from_options(
    connection_type="s3",
    format="parquet",
    connection_options={
        "paths": ["s3://collate-glue-connector-test/glue-sample-data/parquet/"],
        "recurse": True
    },
    transformation_ctx="s3_df"
)

# ---------- WRITE TO JDBC CONNECTION ----------
glueContext.write_dynamic_frame.from_jdbc_conf(
    frame=s3_df,
    catalog_connection="Redshift - Jdbc connection",
    connection_options={
        "database": "dev",
        "dbtable": "customer_sample"
    },
    redshift_tmp_dir="s3://collate-glue-connector-test/temp/",
    transformation_ctx="jdbc_sink"
)

job.commit()
'''
        result = parse_glue_script(script)
        self.assertTrue(result.has_lineage)
        self.assertIn(
            "s3://collate-glue-connector-test/glue-sample-data/parquet/",
            result.s3_sources,
        )
        self.assertEqual(len(result.jdbc_targets), 1)
        self.assertEqual(result.jdbc_targets[0].connection_name, "Redshift - Jdbc connection")
        self.assertEqual(result.jdbc_targets[0].table, "customer_sample")
        self.assertEqual(result.jdbc_targets[0].database, "dev")

    def test_from_catalog_source(self):
        script = '''
datasource = glueContext.create_dynamic_frame.from_catalog(
    database="my_database",
    table_name="my_table",
    transformation_ctx="datasource"
)
'''
        result = parse_glue_script(script)
        self.assertTrue(result.has_lineage)
        self.assertEqual(len(result.catalog_sources), 1)
        self.assertEqual(result.catalog_sources[0].database, "my_database")
        self.assertEqual(result.catalog_sources[0].table, "my_table")

    def test_write_catalog_target(self):
        script = '''
glueContext.write_dynamic_frame.from_catalog(
    frame=output_df,
    database="output_db",
    table_name="output_table",
    transformation_ctx="sink"
)
'''
        result = parse_glue_script(script)
        self.assertTrue(result.has_lineage)
        self.assertEqual(len(result.catalog_targets), 1)
        self.assertEqual(result.catalog_targets[0].database, "output_db")
        self.assertEqual(result.catalog_targets[0].table, "output_table")

    def test_write_options_s3_target(self):
        script = '''
glueContext.write_dynamic_frame.from_options(
    frame=output_df,
    connection_type="s3",
    format="parquet",
    connection_options={"path": "s3://my-bucket/output/data/"},
    transformation_ctx="s3_sink"
)
'''
        result = parse_glue_script(script)
        self.assertTrue(result.has_lineage)
        self.assertIn("s3://my-bucket/output/data/", result.s3_targets)

    def test_spark_read_parquet(self):
        script = '''
df = spark.read.parquet("s3://my-bucket/input/data/")
'''
        result = parse_glue_script(script)
        self.assertTrue(result.has_lineage)
        self.assertIn("s3://my-bucket/input/data/", result.s3_sources)

    def test_spark_read_format_load(self):
        script = '''
df = spark.read.format("parquet").load("s3://my-bucket/input/data/")
'''
        result = parse_glue_script(script)
        self.assertTrue(result.has_lineage)
        self.assertIn("s3://my-bucket/input/data/", result.s3_sources)

    def test_spark_read_jdbc(self):
        script = '''
df = spark.read.jdbc("jdbc:postgresql://myhost:5432/mydb", "public.users")
'''
        result = parse_glue_script(script)
        self.assertTrue(result.has_lineage)
        self.assertEqual(len(result.jdbc_sources), 1)
        self.assertEqual(result.jdbc_sources[0].jdbc_url, "jdbc:postgresql://myhost:5432/mydb")
        self.assertEqual(result.jdbc_sources[0].table, "public.users")

    def test_spark_read_table(self):
        script = '''
df = spark.read.table("my_database.my_table")
'''
        result = parse_glue_script(script)
        self.assertTrue(result.has_lineage)
        self.assertEqual(len(result.catalog_sources), 1)
        self.assertEqual(result.catalog_sources[0].database, "my_database")
        self.assertEqual(result.catalog_sources[0].table, "my_table")

    def test_spark_write_parquet(self):
        script = '''
df.write.parquet("s3://my-bucket/output/")
'''
        result = parse_glue_script(script)
        self.assertTrue(result.has_lineage)
        self.assertIn("s3://my-bucket/output/", result.s3_targets)

    def test_spark_write_format_save(self):
        script = '''
df.write.format("csv").save("s3://my-bucket/output/csv/")
'''
        result = parse_glue_script(script)
        self.assertTrue(result.has_lineage)
        self.assertIn("s3://my-bucket/output/csv/", result.s3_targets)

    def test_spark_write_jdbc(self):
        script = '''
df.write.jdbc("jdbc:mysql://host:3306/mydb", "orders")
'''
        result = parse_glue_script(script)
        self.assertTrue(result.has_lineage)
        self.assertEqual(len(result.jdbc_targets), 1)
        self.assertEqual(result.jdbc_targets[0].jdbc_url, "jdbc:mysql://host:3306/mydb")
        self.assertEqual(result.jdbc_targets[0].table, "orders")

    def test_spark_save_as_table(self):
        script = '''
df.write.saveAsTable("analytics.user_summary")
'''
        result = parse_glue_script(script)
        self.assertTrue(result.has_lineage)
        self.assertEqual(len(result.catalog_targets), 1)
        self.assertEqual(result.catalog_targets[0].database, "analytics")
        self.assertEqual(result.catalog_targets[0].table, "user_summary")

    def test_spark_insert_into(self):
        script = '''
df.write.insertInto("warehouse.events")
'''
        result = parse_glue_script(script)
        self.assertTrue(result.has_lineage)
        self.assertEqual(len(result.catalog_targets), 1)
        self.assertEqual(result.catalog_targets[0].database, "warehouse")
        self.assertEqual(result.catalog_targets[0].table, "events")

    def test_multiple_sources_and_targets(self):
        script = '''
source1 = glueContext.create_dynamic_frame.from_catalog(
    database="raw_db",
    table_name="orders",
    transformation_ctx="source1"
)
source2 = spark.read.parquet("s3://data-lake/customers/")

output_df = some_transform(source1, source2)
output_df.write.saveAsTable("analytics.order_summary")
'''
        result = parse_glue_script(script)
        self.assertTrue(result.has_lineage)
        self.assertEqual(len(result.catalog_sources), 1)
        self.assertEqual(result.catalog_sources[0].table, "orders")
        self.assertIn("s3://data-lake/customers/", result.s3_sources)
        self.assertEqual(len(result.catalog_targets), 1)
        self.assertEqual(result.catalog_targets[0].table, "order_summary")

    def test_no_lineage_script(self):
        script = '''
import sys
print("Hello World")
x = 42
'''
        result = parse_glue_script(script)
        self.assertFalse(result.has_lineage)

    def test_purge_table_target(self):
        script = '''
glueContext.purge_table(
    database="temp_db",
    table_name="staging_data",
    options={"retentionPeriod": 1}
)
'''
        result = parse_glue_script(script)
        self.assertTrue(result.has_lineage)
        self.assertEqual(len(result.catalog_targets), 1)
        self.assertEqual(result.catalog_targets[0].database, "temp_db")
        self.assertEqual(result.catalog_targets[0].table, "staging_data")

    def test_spark_table_single_name(self):
        script = '''
df = spark.read.table("my_table")
'''
        result = parse_glue_script(script)
        self.assertTrue(result.has_lineage)
        self.assertEqual(result.catalog_sources[0].database, "default")
        self.assertEqual(result.catalog_sources[0].table, "my_table")

    def test_s3a_and_s3n_paths(self):
        script = '''
df1 = spark.read.parquet("s3a://bucket1/path/")
df2 = spark.read.json("s3n://bucket2/path/")
'''
        result = parse_glue_script(script)
        self.assertIn("s3a://bucket1/path/", result.s3_sources)
        self.assertIn("s3n://bucket2/path/", result.s3_sources)


class TestParseJdbcUrl(TestCase):
    def test_redshift_url(self):
        from metadata.ingestion.source.pipeline.gluepipeline.metadata import (
            GluepipelineSource,
        )

        result = GluepipelineSource._parse_jdbc_url(
            "jdbc:redshift://cluster.abc123.us-east-1.redshift.amazonaws.com:5439/dev"
        )
        self.assertIsNotNone(result)
        self.assertEqual(result["database"], "dev")

    def test_postgresql_url(self):
        from metadata.ingestion.source.pipeline.gluepipeline.metadata import (
            GluepipelineSource,
        )

        result = GluepipelineSource._parse_jdbc_url(
            "jdbc:postgresql://myhost:5432/mydb"
        )
        self.assertIsNotNone(result)
        self.assertEqual(result["database"], "mydb")

    def test_mysql_url(self):
        from metadata.ingestion.source.pipeline.gluepipeline.metadata import (
            GluepipelineSource,
        )

        result = GluepipelineSource._parse_jdbc_url(
            "jdbc:mysql://myhost:3306/salesdb"
        )
        self.assertIsNotNone(result)
        self.assertEqual(result["database"], "salesdb")

    def test_empty_url(self):
        from metadata.ingestion.source.pipeline.gluepipeline.metadata import (
            GluepipelineSource,
        )

        result = GluepipelineSource._parse_jdbc_url("")
        self.assertIsNone(result)

    def test_invalid_url(self):
        from metadata.ingestion.source.pipeline.gluepipeline.metadata import (
            GluepipelineSource,
        )

        result = GluepipelineSource._parse_jdbc_url("not-a-jdbc-url")
        self.assertIsNone(result)
