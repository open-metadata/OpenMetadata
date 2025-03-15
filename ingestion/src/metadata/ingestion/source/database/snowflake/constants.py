from sqlalchemy.sql.sqltypes import BOOLEANTYPE, VARCHAR

DEFAULT_STREAM_COLUMNS = [
    {
        "name": "METADATA$ACTION",
        "type": VARCHAR(length=16777216),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "TEXT(16777216)",
        "comment": None,
        "primary_key": False,
    },
    {
        "name": "METADATA$ISUPDATE",
        "type": BOOLEANTYPE,
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "BOOLEAN",
        "comment": None,
        "primary_key": False,
    },
    {
        "name": "METADATA$ROW_ID",
        "type": VARCHAR(length=16777216),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "system_data_type": "TEXT(16777216)",
        "comment": None,
        "primary_key": False,
    },
]
