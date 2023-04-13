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
"""
Test the lkml parser
"""
from pathlib import Path
from unittest import TestCase

from metadata.ingestion.source.dashboard.looker.parser import (
    Includes,
    LkmlParser,
    ViewName,
)
from metadata.readers.local import LocalReader

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
