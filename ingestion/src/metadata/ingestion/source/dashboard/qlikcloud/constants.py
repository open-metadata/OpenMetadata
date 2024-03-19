"""
QlikCloud Constants
"""

OPEN_DOC_REQ = {
    "method": "OpenDoc",
    "handle": -1,
    "outKey": -1,
    "id": 1,
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
    "id": 2,
}
GET_SHEET_LAYOUT = {
    "method": "GetLayout",
    "handle": 2,
    "params": [],
    "outKey": -1,
    "id": 3,
}
APP_LOADMODEL_REQ = {
    "delta": True,
    "handle": 1,
    "method": "GetObject",
    "params": ["LoadModel"],
    "id": 4,
    "jsonrpc": "2.0",
}
GET_LOADMODEL_LAYOUT = {
    "delta": True,
    "handle": 3,
    "method": "GetLayout",
    "params": [],
    "id": 5,
    "jsonrpc": "2.0",
}
