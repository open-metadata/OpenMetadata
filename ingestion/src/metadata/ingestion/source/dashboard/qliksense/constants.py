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
QlikSense Constants
"""


GET_DOCS_LIST_REQ = {
    "handle": -1,
    "method": "GetDocList",
    "params": [],
    "outKey": -1,
    "id": 1,
}

OPEN_DOC_REQ = {
    "method": "OpenDoc",
    "handle": -1,
    "outKey": -1,
    "id": 2,
}

CREATE_SHEET_SESSION = {
    "method": "CreateSessionObject",
    "handle": 1,
    "params": [
        {
            "qInfo": {"qType": "SheetList"},
            "qAppObjectListDef": {
                "qType": "sheet",
                "qData": {
                    "title": "/qMetaDef/title",
                    "description": "/qMetaDef/description",
                    "thumbnail": "/thumbnail",
                    "cells": "/cells",
                    "rank": "/rank",
                    "columns": "/columns",
                    "rows": "/rows",
                },
            },
        }
    ],
    "outKey": -1,
    "id": 3,
}

GET_SHEET_LAYOUT = {
    "method": "GetLayout",
    "handle": 2,
    "params": [],
    "outKey": -1,
    "id": 4,
}

APP_LOADMODEL_REQ = {
    "delta": True,
    "handle": 1,
    "method": "GetObject",
    "params": ["LoadModel"],
    "id": 5,
    "jsonrpc": "2.0",
}


GET_LOADMODEL_LAYOUT = {
    "delta": True,
    "handle": 3,
    "method": "GetLayout",
    "params": [],
    "id": 6,
    "jsonrpc": "2.0",
}
