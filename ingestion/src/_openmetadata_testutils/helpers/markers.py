import pytest


def xfail_param(param, reason):
    return pytest.param(param, marks=pytest.mark.xfail(reason=reason, strict=True))
