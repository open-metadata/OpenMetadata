"""Settings to override default settings."""

import logging

#
# Override settings
#
DEBUG = True

HTTP_PORT = 8888
HTTP_ADDRESS = '0.0.0.0'

#
# Set logging level
#
logging.getLogger().setLevel(logging.DEBUG)

JOB_CLASS_PACKAGES = ['ingestion_scheduler.jobs']
