import importlib
import pathlib
from unittest import TestCase

from metadata.config.common import load_config_file
from metadata.ingestion.api.workflow import Workflow
from metadata.ingestion.ometa.openmetadata_rest import (
    MetadataServerConfig,
    OpenMetadataAPIClient,
)


class WorkflowTest(TestCase):
    def test_get_200(self):
        key = "metadata.ingestion.sink.metadata_rest.MetadataRestSink"
        if key.find(".") >= 0:
            module_name, class_name = key.rsplit(".", 1)
            my_class = getattr(importlib.import_module(module_name), class_name)
            self.assertEqual((my_class is not None), True)

    def test_get_4xx(self):
        my_class = None
        key = "metadata.ingestion.sink.MYSQL.mysqlSINK"
        try:
            if key.find(".") >= 0:
                module_name, class_name = key.rsplit(".", 1)
                my_class = getattr(importlib.import_module(module_name), class_name)
        except ModuleNotFoundError:
            self.assertRaises(ModuleNotFoundError)

    def test_title_typeClassFetch(self):
        is_file = True
        file_type = "query-parser"
        if is_file:
            replace = file_type.replace("-", "_")
        else:
            replace = "".join(
                [i.title() for i in file_type.replace("-", "_").split("_")]
            )
        self.assertEqual(replace, "query_parser")

    def test_title_typeClassFetch_4xx(self):
        is_file = False
        file_type = "query-parser"
        if is_file:
            replace = file_type.replace("-", "_")
        else:
            replace = "".join(
                [i.title() for i in file_type.replace("-", "_").split("_")]
            )
        self.assertEqual(replace, "QueryParser")

    def test_execute_200(self):
        config_file = pathlib.Path("tests/unit/mysql_test.json")
        workflow_config = load_config_file(config_file)
        workflow = Workflow.create(workflow_config)
        workflow.execute()
        workflow.stop()
        config = MetadataServerConfig.parse_obj(
            workflow_config.get("metadata_server").get("config")
        )
        client = OpenMetadataAPIClient(config).client

        client.delete(
            f"/services/databaseServices/"
            f"{client.get('/services/databaseServices/name/local_mysql_test')['id']}"
        )
        file_path = "/tmp/mysql_test"
        with open(file_path) as ingestionFile:
            ingestionData = ingestionFile.read()
        self.assertEqual(ingestionData is not None, True)

    def test_execute_4xx(self):
        config_file = pathlib.Path("tests/unit/mysql_test.json")
        workflow_config = load_config_file(config_file)
        ingestionData = None
        try:
            file_path = "/tmp/mysql_test123"
            with open(file_path) as ingestionFile:
                ingestionData = ingestionFile.read()
        except FileNotFoundError:
            self.assertRaises(FileNotFoundError)
