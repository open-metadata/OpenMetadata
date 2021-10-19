from setuptools import find_namespace_packages, setup

setup(
    name="openmetadata-airflow",
    version="1.0.dev0",
    description="Python Distribution Utilities",
    packages=find_namespace_packages(
        where="./apache_airflow_provider", exclude=["tests*"]
    ),
    entry_points={
        "apache_airflow_provider": [
            "provider_info = airflow_provider_openmetadata:get_provider_config"
        ],
    },
)
