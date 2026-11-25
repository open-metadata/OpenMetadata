"""The catalog model is the contract the seed relies on: deterministic, unique, and acyclic."""

from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from catalog import LAYER_BY_KEY, LAYERS, AssetRef, Catalog  # noqa: E402

LAYER_RANK = {layer.key: rank for rank, layer in enumerate(LAYERS)}
SIZE = 5000


@pytest.fixture(scope="module")
def catalog() -> Catalog:
    return Catalog(SIZE, "acme", 7)


def every_asset(catalog: Catalog):
    for layer in LAYERS:
        for domain in range(len(catalog.domains)):
            for index in range(catalog.count(layer.key, domain)):
                yield AssetRef(layer.key, domain, index)


def test_layers_add_up_to_the_requested_size(catalog):
    assert sum(catalog.layer_total(layer.key) for layer in LAYERS) == pytest.approx(SIZE, rel=0.02)


def test_every_asset_has_a_unique_fqn(catalog):
    fqns = Counter(catalog.placement(ref).fqn for ref in every_asset(catalog))

    assert [fqn for fqn, seen in fqns.items() if seen > 1] == []


def test_the_same_seed_builds_the_same_graph():
    first, second = Catalog(SIZE, "acme", 7), Catalog(SIZE, "acme", 7)
    sample = [AssetRef("mart", 2, 11), AssetRef("core", 0, 3), AssetRef("dashboard", 4, 1)]

    assert [first.placement(ref) for ref in sample] == [second.placement(ref) for ref in sample]
    assert [first.edges(ref) for ref in sample] == [second.edges(ref) for ref in sample]


def test_a_different_seed_builds_a_different_graph():
    refs = [AssetRef("source", 0, index) for index in range(40)]
    one, other = Catalog(SIZE, "acme", 7), Catalog(SIZE, "acme", 8)

    assert [one.concept(ref) for ref in refs] != [other.concept(ref) for ref in refs]


def test_lineage_only_flows_downstream_and_never_cycles(catalog):
    for ref in every_asset(catalog):
        for upstream, _ in catalog.upstreams(ref):
            assert upstream.index < catalog.count(upstream.layer, upstream.domain)
            if upstream.layer == ref.layer:
                assert catalog.is_dim(upstream) and not catalog.is_dim(ref)
            else:
                assert LAYER_RANK[upstream.layer] < LAYER_RANK[ref.layer]


def test_a_model_inherits_its_concept_from_its_primary_upstream(catalog):
    staging = AssetRef("staging", 1, 5)

    assert catalog.concept(staging) == catalog.concept(catalog.primary_upstream(staging))
    assert catalog.placement(staging).name.startswith("stg_")


def test_column_lineage_names_real_columns_on_both_sides(catalog):
    for ref in [AssetRef(layer.key, 0, 0) for layer in LAYERS if layer.key != "source"]:
        for edge in catalog.edges(ref):
            upstream = {
                f"{catalog.placement(edge.upstream).fqn}.{c.name}" for c in catalog.columns(edge.upstream)
            }
            downstream = {
                f"{catalog.placement(edge.downstream).fqn}.{c.name}" for c in catalog.columns(edge.downstream)
            }
            for sources, target, _ in catalog.column_lineage(edge):
                assert set(sources) <= upstream
                assert target in downstream


def test_column_names_are_unique_within_every_asset(catalog):
    for ref in every_asset(catalog):
        names = [column.name for column in catalog.columns(ref)]
        assert len(names) == len(set(names)), (ref, names)


def test_hub_dimensions_fan_out_far_beyond_the_average(catalog):
    fan_out = Counter(upstream for ref in every_asset(catalog) for upstream, _ in catalog.upstreams(ref))
    edges = sum(fan_out.values())

    assert fan_out.most_common(1)[0][1] > 20 * edges / len(fan_out)


def test_the_layer_band_stays_under_the_scene_size_cap(catalog):
    services = len(catalog.database_services()) + len(catalog.other_services())

    assert services < 200


def test_a_data_model_is_named_like_the_server_names_it(catalog):
    assert catalog.placement(AssetRef("bi_model", 0, 0)).fqn.startswith("acme_looker_prod.model.")


def test_only_fivetran_and_airflow_edges_name_a_pipeline(catalog):
    carriers = {edge.carrier for ref in every_asset(catalog) for edge in catalog.edges(ref)}

    assert carriers <= {None, "fivetran", "airflow_prod"}


def test_pii_columns_are_tagged(catalog):
    customers = next(
        ref
        for ref in every_asset(catalog)
        if ref.layer == "source" and catalog.concept(ref).plural == "customers"
    )
    tags = {column.name: column.tag for column in catalog.columns(customers)}

    assert tags["email"] == "PII.Sensitive"
    assert tags["customer_id"] is None


def test_refuses_a_catalog_too_small_to_hold_every_layer():
    with pytest.raises(ValueError):
        Catalog(100, "acme", 1)


def test_table_layers_fill_schemas_to_their_capacity(catalog):
    for layer in ("staging", "core", "mart"):
        capacity = LAYER_BY_KEY[layer].capacity
        schema_count = catalog.schema_count(layer, 0)
        assert schema_count * capacity >= catalog.count(layer, 0) > (schema_count - 1) * capacity
