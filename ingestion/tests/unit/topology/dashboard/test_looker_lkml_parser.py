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
Test the lkml parser
"""
from pathlib import Path
from unittest import TestCase

from looker_sdk.sdk.api40.models import (
    LookmlModelExplore,
    LookmlModelExploreField,
    LookmlModelExploreFieldset,
)

from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType
from metadata.ingestion.source.dashboard.looker.columns import get_columns_from_model
from metadata.ingestion.source.dashboard.looker.links import get_path_from_link
from metadata.ingestion.source.dashboard.looker.parser import (
    Includes,
    LkmlParser,
    ViewName,
)
from metadata.readers.file.local import LocalReader

BASE_PATH = Path(__file__).parent.parent.parent / "resources/lkml"


class TestLkmlParser(TestCase):
    """
    Check the parser with the local reader
    """

    def test_local_parser_with_birds(self):
        """
        Birds view is declared in the explore file.
        Nothing else to parse, so no visited files
        """

        reader = LocalReader(BASE_PATH)
        parser = LkmlParser(reader)

        view = parser.find_view(
            view_name=ViewName("birds"), path=Includes("cats.explore.lkml")
        )

        self.assertIsNotNone(view)
        self.assertEqual(view.name, "birds")

        self.assertEqual(parser.get_view_from_cache(ViewName("birds")).name, "birds")
        self.assertEqual(
            parser._visited_files,
            {
                "cats.explore.lkml": ["views/cats.view.lkml", "views/dogs.view.lkml"],
            },
        )

    def test_local_parser_with_cats(self):
        """
        Cats view is in a separate view file which we need to visit.
        We go there before jumping into the dogs, and stop.
        """

        reader = LocalReader(BASE_PATH)
        parser = LkmlParser(reader)

        view = parser.find_view(
            view_name=ViewName("cats"), path=Includes("cats.explore.lkml")
        )

        self.assertIsNotNone(view)
        self.assertEqual(view.name, "cats")

        self.assertEqual(parser.get_view_from_cache(ViewName("cats")).name, "cats")
        self.assertEqual(
            parser._visited_files,
            {
                "cats.explore.lkml": ["views/cats.view.lkml", "views/dogs.view.lkml"],
                "views/cats.view.lkml": [],
            },
        )

    def test_local_parser_with_dogs(self):
        """
        Dogs view is in a separate view file which we need to visit.
        We go after visiting the cats, so we need to parse both
        """

        reader = LocalReader(BASE_PATH)
        parser = LkmlParser(reader)

        view = parser.find_view(
            view_name=ViewName("dogs"), path=Includes("cats.explore.lkml")
        )

        self.assertIsNotNone(view)
        self.assertEqual(view.name, "dogs")

        self.assertEqual(parser.get_view_from_cache(ViewName("dogs")).name, "dogs")
        self.assertEqual(
            parser._visited_files,
            {
                "cats.explore.lkml": ["views/cats.view.lkml", "views/dogs.view.lkml"],
                "views/cats.view.lkml": [],
                "views/dogs.view.lkml": [],
            },
        )

        # Now I can directly get the cats view from the cache as well
        # as I already visited that file
        self.assertEqual(parser.get_view_from_cache(ViewName("cats")).name, "cats")

    def test_local_parser_with_kittens(self):
        """
        We will now parse the kittens explore looking for the cats view.
        This requires two jumps: Kittens explore -> Kittens View -> Cats View
        """

        reader = LocalReader(BASE_PATH)
        parser = LkmlParser(reader)

        view = parser.find_view(
            view_name=ViewName("cats"), path=Includes("kittens.explore.lkml")
        )

        self.assertIsNotNone(view)
        self.assertEqual(view.name, "cats")

        self.assertEqual(parser.get_view_from_cache(ViewName("cats")).name, "cats")
        self.assertEqual(
            parser._visited_files,
            {
                "kittens.explore.lkml": [
                    "views/kittens.view.lkml",
                    "views/dogs.view.lkml",
                ],
                "views/kittens.view.lkml": ["views/cats.view.lkml"],
                "views/cats.view.lkml": [],
            },
        )

    def test_recursive_explore(self):
        """
        We should stop the execution
        """
        reader = LocalReader(BASE_PATH)
        parser = LkmlParser(reader)

        view = parser.find_view(
            view_name=ViewName("recursive_call"),
            path=Includes("recursive.explore.lkml"),
        )
        self.assertIsNotNone(view)

        view = parser.find_view(
            view_name=ViewName("recursive"), path=Includes("recursive.explore.lkml")
        )
        self.assertIsNotNone(view)

    def test_get_path_from_link(self):
        """
        Validate utility
        """
        simple_link = "/projects/my_project/files/hello.explore.lkml"
        self.assertEqual(get_path_from_link(simple_link), "hello.explore.lkml")

        link = "/projects/my_project/files/hello%2Fexplores%2Fmy_explore.explore.lkml?line=13"
        self.assertEqual(
            get_path_from_link(link), "hello/explores/my_explore.explore.lkml"
        )

        link_no_files = "hello%2Fexplores%2Fmy_explore.explore.lkml?line=13"
        self.assertEqual(
            get_path_from_link(link_no_files), "hello/explores/my_explore.explore.lkml"
        )

    def test_expand(self):
        """
        We can expand a single Path. We are looking for "*/cats.view", which will
        match a file in the resources directory "cats.view.lkml"
        """
        path = Includes("*/cats.view")

        reader = LocalReader(BASE_PATH)
        parser = LkmlParser(reader)

        self.assertIn("cats.view.lkml", parser._expand(path)[0])

    def test_explore_col_parser(self):
        """
        We can parse a looker explore
        """

        explore = LookmlModelExplore(
            name="test-explore",
            fields=LookmlModelExploreFieldset(
                dimensions=[
                    LookmlModelExploreField(
                        name="dim1",
                        label="Dim 1 Label",
                        type="yesno",
                        description=None,
                    ),
                    LookmlModelExploreField(
                        name="dim2",
                        label_short="Dim 2 Label Short",
                        type="list",
                        description="something",
                    ),
                ],
                measures=[
                    LookmlModelExploreField(
                        name="measure1",
                        type="duration_day",
                    )
                ],
            ),
        )

        cols = get_columns_from_model(explore)
        expected_cols = [
            Column(
                name=ColumnName("dim1"),
                displayName="Dim 1 Label",
                dataType=DataType.BOOLEAN,
                dataTypeDisplay="yesno",
                description=None,
            ),
            Column(
                name=ColumnName("dim2"),
                displayName="Dim 2 Label Short",
                dataType=DataType.ARRAY,
                arrayDataType=DataType.UNKNOWN,
                dataTypeDisplay="list",
                description="something",
            ),
            Column(
                name=ColumnName("measure1"),
                displayName=None,
                dataType=DataType.STRING,
                dataTypeDisplay="duration_day",
                description=None,
            ),
        ]

        self.assertEqual(cols, expected_cols)

    def test_view_col_parser(self):
        """
        Test we can parse a view
        """

        reader = LocalReader(BASE_PATH)
        parser = LkmlParser(reader)

        view = parser.find_view(
            view_name=ViewName("cats"), path=Includes("kittens.explore.lkml")
        )

        cols = get_columns_from_model(view)
        expected_cols = [
            Column(
                name=ColumnName("name"),
                dataType=DataType.STRING,
                dataTypeDisplay="string",
            ),
            Column(
                name=ColumnName("age"),
                dataType=DataType.NUMBER,
                dataTypeDisplay="int",
            ),
        ]

        self.assertEqual(cols, expected_cols)
