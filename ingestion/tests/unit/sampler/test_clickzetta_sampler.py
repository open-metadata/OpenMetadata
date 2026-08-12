"""Offline SQL compilation tests for ClickZetta sampling."""

from types import MethodType, SimpleNamespace

import pytest
from sqlalchemy import Column, Integer, MetaData, Table, select
from sqlalchemy.orm import declarative_base

from metadata.generated.schema.type.basic import ProfileSampleType, SamplingMethodType
from metadata.sampler.sqlalchemy.clickzetta.sampler import ClickzettaSampler


def _clickzetta_dialect():
    pytest.importorskip("sqlalchemy_clickzetta")
    from sqlalchemy.engine import make_url

    return make_url("clickzetta://").get_dialect()()


@pytest.mark.parametrize(
    ("sample_type", "sample_method", "sample", "expected"),
    [
        (ProfileSampleType.ROWS, SamplingMethodType.BERNOULLI, 5_000, "TABLESAMPLE ROW(5000 ROWS)"),
        (ProfileSampleType.ROWS, SamplingMethodType.SYSTEM, 25, "TABLESAMPLE system(25 ROWS)"),
        (ProfileSampleType.PERCENTAGE, SamplingMethodType.BERNOULLI, 10, "TABLESAMPLE ROW(10)"),
        (ProfileSampleType.PERCENTAGE, SamplingMethodType.SYSTEM, 10, "TABLESAMPLE system(10)"),
    ],
)
def test_clickzetta_sampler_supports_standard_sampling_modes(sample_type, sample_method, sample, expected):
    table = Table("orders", MetaData(), Column("order_id", Integer), schema="seller_center")
    static = SimpleNamespace(
        profileSample=sample,
        profileSampleType=sample_type,
        samplingMethodType=sample_method,
    )

    sampler = object.__new__(ClickzettaSampler)
    sampler.connection = SimpleNamespace(pool=SimpleNamespace(dispose=lambda: None))
    sampled = sampler.set_tablesample(static, table)
    sql = str(select(sampled).compile(dialect=_clickzetta_dialect(), compile_kwargs={"literal_binds": True}))

    assert expected in sql
    assert "seller_center" in sql


def test_clickzetta_sampler_builds_native_tablesample_cte():
    base = declarative_base()

    class Orders(base):
        __tablename__ = "orders"
        order_id = Column(Integer, primary_key=True)

    sampler = object.__new__(ClickzettaSampler)
    sampler.connection = SimpleNamespace(pool=SimpleNamespace(dispose=lambda: None))
    sampler._table = Orders
    sampler.get_sampler_table_name = lambda: "orders_sample"
    sampler._base_sample_query = MethodType(lambda _self, selectable, _column: select(selectable), sampler)
    sampler.session_factory = _QuerySession
    static = SimpleNamespace(
        profileSample=25,
        profileSampleType=ProfileSampleType.ROWS,
        samplingMethodType=SamplingMethodType.BERNOULLI,
    )

    sample = sampler.get_sample_query(static)
    sql = str(sample.compile(dialect=_clickzetta_dialect(), compile_kwargs={"literal_binds": True}))

    assert "TABLESAMPLE ROW(25 ROWS)" in sql


def test_clickzetta_sampler_without_sampling_returns_the_raw_dataset():
    raw_dataset = object()
    sampler = object.__new__(ClickzettaSampler)
    sampler.connection = SimpleNamespace(pool=SimpleNamespace(dispose=lambda: None))
    sampler.sample_query = None
    sampler._resolve_sample_config = None
    sampler.partition_details = None
    sampler._table = raw_dataset

    assert sampler.get_dataset() is raw_dataset


class _QuerySession:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    @staticmethod
    def query(selectable):
        return select(selectable)
