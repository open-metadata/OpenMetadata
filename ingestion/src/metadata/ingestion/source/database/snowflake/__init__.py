config = {
    # example of class definition
    "test_suite_interface": "metadata.data_quality.interface.sqlalchemy.snowflake.test_suite_interface.SnowflakeTestSuiteInterface",
    # example of dependency - will be consumed setup.py in some form
    # will probably be easier to consume with a yaml file...
    "depndenices": [
        "super-dependency==1.0.0"
    ]
}
