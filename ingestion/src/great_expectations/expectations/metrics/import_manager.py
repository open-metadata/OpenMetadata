"""
This file manages common global-level imports for which we want to centralize error handling
"""
import logging

logger = logging.getLogger(__name__)
sa_import_warning_required = False
spark_import_warning_required = False

try:
    import sqlalchemy as sa
except ImportError:
    logger.debug("No SqlAlchemy module available.")
    sa = None

try:
    from sqlalchemy.engine import reflection
except ImportError:
    logger.debug("No SqlAlchemy module available.")
    reflection = None

try:
    import pyspark.sql.functions as F
    import pyspark.sql.types as sparktypes
except ImportError:
    logger.debug("No spark functions module available.")
    sparktypes = None
    F = None

try:
    from pyspark.ml.feature import Bucketizer
except ImportError:
    logger.debug("No spark Bucketizer available.")
    Bucketizer = None

try:
    from pyspark.sql import Window
except ImportError:
    logger.debug("No spark Window function available.")
    Window = None

try:
    from pyspark.sql import SQLContext
except ImportError:
    logger.debug("No spark SQLContext available.")
    SQLContext = None
