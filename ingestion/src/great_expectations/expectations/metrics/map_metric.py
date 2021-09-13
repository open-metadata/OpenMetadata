import warnings

# noinspection PyUnresolvedReferences
from .map_metric_provider import *

warnings.warn(
    f"""The module "{__name__}" has been renamed to "{__name__}_provider" -- the alias "{__name__}" will be deprecated \
in the future.
""",
    DeprecationWarning,
    stacklevel=2,
)
