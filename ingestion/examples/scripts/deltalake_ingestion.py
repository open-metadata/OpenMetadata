#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import json

import pyspark
from delta import configure_spark_with_delta_pip

from metadata.ingestion.api.workflow import Workflow

config = """
{
	"source": {
		"type": "deltalake",
		"config": {
			"platform_name": "deltalake",
			"database": "delta",
			"service_name": "local_deltalake1",
			"schema_filter_pattern": {
				"excludes": ["deltalake.*", "information_schema.*", "performance_schema.*", "sys.*"]
			}
		}
	},
	"sink": {
		"type": "metadata-rest",
		"config": {}
	},
	"metadata_server": {
		"type": "metadata-server",
		"config": {
			"api_endpoint": "http://localhost:8585/api",
			"auth_provider_type": "no-auth"
		}
	}
}
"""


def execute_workflow():
    builder = (
        pyspark.sql.SparkSession.builder.master("local[*]")
        .appName("MyApp")
        .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
        .config(
            "spark.sql.catalog.spark_catalog",
            "org.apache.spark.sql.delta.catalog.DeltaCatalog",
        )
    )
    spark = configure_spark_with_delta_pip(builder).getOrCreate()
    workflow = Workflow.create(json.loads(config))
    workflow.set_spark(spark)
    workflow.execute()
    workflow.stop()
    print("SUCCESS!")


if __name__ == "__main__":
    execute_workflow()
