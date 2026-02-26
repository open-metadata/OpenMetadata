#  Copyright 2026 Collate
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
Test Sigma API client pagination logic in get_chart_details().
"""

from typing import List, Optional

from metadata.ingestion.source.dashboard.sigma.models import (
    Elements,
    ElementsResponse,
    WorkBookPage,
    WorkBookPageResponse,
)


def get_chart_details(client_get, workbook_id: str) -> Optional[List[Elements]]:
    """
    Test implementation of get_chart_details pagination logic.
    """
    elements_list = []
    pages = WorkBookPageResponse.model_validate(
        client_get(f"/workbooks/{workbook_id}/pages")
    )
    if not pages.entries:
        return None

    for page in pages.entries:
        elements_list.extend(_get_page_elements(client_get, workbook_id, page.pageId))

    while pages.nextPage:
        pages = WorkBookPageResponse.model_validate(
            client_get(
                f"/workbooks/{workbook_id}/pages",
                data={"page": int(pages.nextPage)},
            )
        )
        if not pages.entries:
            break
        for page in pages.entries:
            elements_list.extend(
                _get_page_elements(client_get, workbook_id, page.pageId)
            )
    return elements_list


def _get_page_elements(client_get, workbook_id: str, page_id: str) -> List[Elements]:
    elements = []
    result = ElementsResponse.model_validate(
        client_get(f"/workbooks/{workbook_id}/pages/{page_id}/elements")
    )
    if result:
        elements.extend(result.entries)
        while result.nextPage:
            result = ElementsResponse.model_validate(
                client_get(
                    f"/workbooks/{workbook_id}/pages/{page_id}/elements",
                    data={"page": int(result.nextPage)},
                )
            )
            if result:
                elements.extend(result.entries)
    return elements


WORKBOOK_ID = "test-workbook-123"


class TestGetChartDetailsSinglePage:
    def test_returns_elements_for_single_page_workbook(self):
        def mock_api(path, data=None):
            if "/pages" in path and "/elements" not in path:
                return {"entries": [{"pageId": "page-1"}], "total": 1, "nextPage": None}
            if "/elements" in path:
                return {
                    "entries": [
                        {
                            "elementId": "el-1",
                            "name": "Revenue Chart",
                            "vizualizationType": "bar",
                        },
                        {
                            "elementId": "el-2",
                            "name": "Users Table",
                            "vizualizationType": "table",
                        },
                    ],
                    "total": 2,
                    "nextPage": None,
                }
            return {}

        result = get_chart_details(mock_api, WORKBOOK_ID)

        assert result is not None
        assert len(result) == 2
        assert result[0].elementId == "el-1"
        assert result[1].elementId == "el-2"


class TestGetChartDetailsMultiplePages:
    def test_returns_elements_from_all_pages(self):
        def mock_api(path, data=None):
            if "/pages" in path and "/elements" not in path:
                if data is None:
                    return {
                        "entries": [{"pageId": "page-1"}],
                        "total": 2,
                        "nextPage": "2",
                    }
                return {"entries": [{"pageId": "page-2"}], "total": 2, "nextPage": None}
            if "/elements" in path:
                if "page-1" in path:
                    return {
                        "entries": [
                            {
                                "elementId": "el-A",
                                "name": "Chart A",
                                "vizualizationType": "bar",
                            }
                        ],
                        "total": 1,
                        "nextPage": None,
                    }
                return {
                    "entries": [
                        {
                            "elementId": "el-B",
                            "name": "Chart B",
                            "vizualizationType": "pie",
                        }
                    ],
                    "total": 1,
                    "nextPage": None,
                }
            return {}

        result = get_chart_details(mock_api, WORKBOOK_ID)

        assert result is not None
        assert len(result) == 2
        element_ids = {e.elementId for e in result}
        assert "el-A" in element_ids
        assert "el-B" in element_ids


class TestGetChartDetailsNoPages:
    def test_returns_none_when_workbook_has_no_pages(self):
        def mock_api(path, data=None):
            return {"entries": [], "total": 0, "nextPage": None}

        result = get_chart_details(mock_api, WORKBOOK_ID)

        assert result is None
