"""
Default service specs for services.
"""

from metadata.utils.service_spec.service_spec import BaseSpec


class DefaultDatabaseSpec(BaseSpec):
    profiler_class: str | None = "metadata.profiler.interface.sqlalchemy.profiler_interface.SQAProfilerInterface"
    sampler_class: str | None = "metadata.sampler.sqlalchemy.sampler.SQASampler"
    test_suite_class: str | None = (
        "metadata.data_quality.interface.sqlalchemy.sqa_test_suite_interface.SQATestSuiteInterface"
    )
    data_diff: str | None = (
        "metadata.data_quality.validations.runtime_param_setter.base_diff_params_setter.BaseTableParameter"
    )
