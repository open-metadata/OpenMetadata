"""
Default service specs for services.
"""

from typing import Optional

from metadata.data_quality.interface.sqlalchemy.sqa_test_suite_interface import (
    SQATestSuiteInterface,
)
from metadata.data_quality.validations.runtime_param_setter.base_diff_params_setter import (
    BaseTableParameter,
)
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.sampler.sqlalchemy.sampler import SQASampler
from metadata.utils.importer import get_class_path
from metadata.utils.service_spec.service_spec import BaseSpec


class DefaultDatabaseSpec(BaseSpec):
    profiler_class: Optional[str] = get_class_path(SQAProfilerInterface)
    sampler_class: Optional[str] = get_class_path(SQASampler)
    test_suite_class: Optional[str] = get_class_path(SQATestSuiteInterface)
    data_diff: Optional[str] = get_class_path(BaseTableParameter)
