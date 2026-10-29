"""A deterministic model of the seeded catalog: every asset, its place, its columns and its lineage.

Nothing is stored. Each asset is addressed by (layer, domain, index) and everything about it — its
service, database, schema, name, columns and upstream edges — is a pure function of that address
and the seed. That is what lets a 2M-asset load resume after a crash without a 2M-row state file,
and lets the lineage phase name an upstream FQN without looking anything up on the server.

Layers follow a medallion platform:

    source (OLTP tables) -> stream (CDC topics) -> raw -> staging -> core (dims + facts)
        -> mart -> bi_model -> dashboard, and core/mart -> ml_model
"""

from __future__ import annotations

import hashlib
import math
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache

from vocabulary import (
    BI_SERVICES,
    DOMAINS,
    KAFKA_SERVICES,
    KINDS,
    MART_GRAINS,
    ML_SERVICES,
    PIPELINE_SERVICES,
    QUALIFIERS,
    WAREHOUSES,
    Concept,
    Domain,
)

TABLE = "table"
TOPIC = "topic"
DATA_MODEL = "dashboardDataModel"
DASHBOARD = "dashboard"
ML_MODEL = "mlmodel"
PIPELINE = "pipeline"


@dataclass(frozen=True)
class Layer:
    key: str
    entity_type: str
    share: float
    capacity: int
    schemas_per_database: int = 40


LAYERS: tuple[Layer, ...] = (
    Layer("source", TABLE, 0.12, 120),
    Layer("stream", TOPIC, 0.04, 0),
    Layer("raw", TABLE, 0.12, 120),
    Layer("staging", TABLE, 0.20, 250),
    Layer("core", TABLE, 0.245, 300),
    Layer("mart", TABLE, 0.20, 300),
    Layer("bi_model", DATA_MODEL, 0.03, 0),
    Layer("dashboard", DASHBOARD, 0.04, 0),
    Layer("ml_model", ML_MODEL, 0.005, 0),
)
LAYER_BY_KEY = {layer.key: layer for layer in LAYERS}
TABLE_LAYERS = tuple(layer.key for layer in LAYERS if layer.entity_type == TABLE)
SOURCE_SCHEMAS = ("public", "app", "core", "ops", "audit", "reference", "events", "legacy")
DIM_SHARE = 0.04
ZIPF_ALPHA = 2.2
MIN_ASSETS = 1000
MAX_COLUMN_LINEAGE = 24
SQL_PREVIEW_COLUMNS = 4
DATA_MODEL_INFIX = "model"
CONCEPT_CACHE_SIZE = 1 << 16
SCHEMA_CACHE_SIZE = 4096


@dataclass(frozen=True)
class AssetRef:
    layer: str
    domain: int
    index: int


@dataclass(frozen=True)
class Placement:
    service: str
    database: str | None
    schema: str | None
    name: str

    @property
    def container_fqn(self) -> str:
        return ".".join(part for part in (self.service, self.database, self.schema) if part)

    @property
    def fqn(self) -> str:
        if self.database is None:
            return f"{self.service}.{self.name}"
        return f"{self.container_fqn}.{self.name}"


@dataclass(frozen=True)
class Column:
    name: str
    data_type: str
    description: str
    length: int | None = None
    precision: tuple[int, int] | None = None
    tag: str | None = None


@dataclass(frozen=True)
class Edge:
    upstream: AssetRef
    downstream: AssetRef
    carrier: str | None
    source: str


def mix(*parts: object) -> int:
    """A stable 64-bit hash: Python's hash() is salted per process and would break resumes."""
    digest = hashlib.blake2b("|".join(map(str, parts)).encode(), digest_size=8).digest()
    return int.from_bytes(digest, "big")


def unit(*parts: object) -> float:
    return mix(*parts) / 2**64


class Catalog:
    """The whole plan for `assets` data assets, named under `prefix`."""

    def __init__(self, assets: int, prefix: str, seed: int) -> None:
        if assets < MIN_ASSETS:
            raise ValueError(f"--assets must be at least {MIN_ASSETS}")
        self.assets = assets
        self.prefix = prefix
        self.seed = seed
        self.domains = DOMAINS
        self._counts = self._allocate()
        # Per-instance and bounded: the lineage phase looks the same upstreams up again and again.
        self.concept = lru_cache(maxsize=CONCEPT_CACHE_SIZE)(self._concept)
        self._schema_names = lru_cache(maxsize=SCHEMA_CACHE_SIZE)(self._compute_schema_names)

    # ------------------------------------------------------------ sizing

    def _allocate(self) -> dict[tuple[str, int], int]:
        total_weight = sum(domain.weight for domain in self.domains)
        counts: dict[tuple[str, int], int] = {}
        for layer in LAYERS:
            for index, domain in enumerate(self.domains):
                share = self.assets * layer.share * domain.weight / total_weight
                minimum = 1 if layer.entity_type == TABLE else 0
                counts[(layer.key, index)] = max(minimum, int(share))
        for index in range(len(self.domains)):
            sources = counts[("source", index)]
            counts[("raw", index)] = sources
            counts[("stream", index)] = min(counts[("stream", index)], sources)
        return counts

    def count(self, layer: str, domain: int) -> int:
        return self._counts[(layer, domain)]

    def layer_total(self, layer: str) -> int:
        return sum(self.count(layer, domain) for domain in range(len(self.domains)))

    def dims(self, domain: int) -> int:
        return max(1, int(self.count("core", domain) * DIM_SHARE))

    # ------------------------------------------------------------ services

    def service_name(self, key: str) -> str:
        return f"{self.prefix}_{key}"

    def source_systems(self, domain: int) -> list[str]:
        return [system.name for system in self.domains[domain].systems]

    def kafka_service(self, domain: int) -> str:
        emea = self.domains[domain].warehouse.endswith("emea")
        return self.service_name("kafka_cdc_emea" if emea else "kafka_cdc_amer")

    def database_services(self) -> list[tuple[str, str, str, str | None]]:
        """(name, service type, description, domain name or None for shared platforms)."""
        services = [
            (self.service_name(system.name), system.engine, system.description, domain.name)
            for domain in self.domains
            for system in domain.systems
        ]
        services += [
            (self.service_name(key), engine, description, None)
            for key, (engine, description) in WAREHOUSES.items()
        ]
        return services

    def other_services(self) -> list[tuple[str, str, str, str]]:
        """(collection path, name, service type, description) for non-database services."""
        services = [
            ("messagingServices", self.service_name(key), kind, description)
            for key, (kind, description) in KAFKA_SERVICES.items()
        ]
        services += [
            ("pipelineServices", self.service_name(key), kind, description)
            for key, (kind, description) in PIPELINE_SERVICES.items()
        ]
        services += [
            ("dashboardServices", self.service_name(key), kind, description)
            for key, (kind, _, description) in BI_SERVICES.items()
        ]
        services += [
            ("mlmodelServices", self.service_name(key), kind, description)
            for key, (kind, description) in ML_SERVICES.items()
        ]
        return services

    # ------------------------------------------------------------ containers

    def schema_count(self, layer: str, domain: int) -> int:
        capacity = LAYER_BY_KEY[layer].capacity
        return math.ceil(self.count(layer, domain) / capacity) if capacity else 0

    def schema_placement(self, layer: str, domain: int, schema_index: int) -> tuple[str, str, str]:
        """(service, database, schema) of one schema of a table layer."""
        if layer == "source":
            return self._source_schema(domain, schema_index)
        if layer == "raw":
            service, database, schema = self._source_schema(domain, schema_index)
            system = service[len(self.prefix) + 1 :]
            warehouse = self.service_name(self.domains[domain].warehouse)
            return warehouse, "raw", f"{system}_{database}_{schema}"
        return self._modelled_schema(layer, domain, schema_index)

    def _source_schema(self, domain: int, schema_index: int) -> tuple[str, str, str]:
        systems = self.domains[domain].systems
        system = systems[schema_index % len(systems)]
        ordinal = schema_index // len(systems)
        database = system.databases[ordinal % len(system.databases)]
        position = ordinal // len(system.databases)
        return self.service_name(system.name), database, _numbered(SOURCE_SCHEMAS, position)

    def _modelled_schema(self, layer: str, domain: int, schema_index: int) -> tuple[str, str, str]:
        spec = self.domains[domain]
        warehouse = spec.mart_warehouse if layer == "mart" else spec.warehouse
        suffix = {"staging": "staging", "core": "core", "mart": "marts"}[layer]
        shard = schema_index // LAYER_BY_KEY[layer].schemas_per_database
        database = f"{spec.name}_{suffix}" + (f"_{shard + 1}" if shard else "")
        schema = _numbered(spec.subjects, schema_index % LAYER_BY_KEY[layer].schemas_per_database)
        return self.service_name(warehouse), database, schema

    def databases(self) -> list[tuple[str, str, str]]:
        """Every (service, database, description) the table layers need, de-duplicated."""
        seen: dict[tuple[str, str], str] = {}
        for layer in TABLE_LAYERS:
            for domain in range(len(self.domains)):
                for schema_index in range(self.schema_count(layer, domain)):
                    service, database, _ = self.schema_placement(layer, domain, schema_index)
                    seen.setdefault((service, database), self._database_description(layer, domain, database))
        return [(service, database, text) for (service, database), text in seen.items()]

    def schemas(self) -> list[tuple[str, str, str, int, str]]:
        """Every (service, database, schema, domain, layer) of the table layers."""
        found = []
        for layer in TABLE_LAYERS:
            for domain in range(len(self.domains)):
                for schema_index in range(self.schema_count(layer, domain)):
                    service, database, schema = self.schema_placement(layer, domain, schema_index)
                    found.append((service, database, schema, domain, layer))
        return found

    def _database_description(self, layer: str, domain: int, database: str) -> str:
        spec = self.domains[domain]
        return {
            "source": f"Operational database `{database}` of the {spec.display} domain's application.",
            "raw": "Landing zone: unmodified copies of every source table, one schema per connector.",
            "staging": f"dbt staging models of {spec.display}: cleaned, typed and deduplicated sources.",
            "core": f"Governed {spec.display} dimensions and facts; the domain's source of truth.",
            "mart": f"Aggregated {spec.display} marts that feed dashboards and reverse ETL.",
        }[layer]

    # ------------------------------------------------------------ assets

    def _concept(self, ref: AssetRef) -> Concept:
        """Inherited along the primary upstream, so stg_orders really comes from raw orders."""
        if ref.layer == "source":
            concepts = self.domains[ref.domain].concepts
            return concepts[mix(self.seed, "concept", ref.domain, ref.index) % len(concepts)]
        return self.concept(self.primary_upstream(ref))

    def placement(self, ref: AssetRef) -> Placement:
        layer = LAYER_BY_KEY[ref.layer]
        if layer.entity_type == TABLE:
            return self._table_placement(ref)
        return self._service_level_placement(ref)

    def _table_placement(self, ref: AssetRef) -> Placement:
        capacity = LAYER_BY_KEY[ref.layer].capacity
        schema_index, slot = divmod(ref.index, capacity)
        service, database, schema = self.schema_placement(ref.layer, ref.domain, schema_index)
        if ref.layer == "raw":
            name = self.placement(AssetRef("source", ref.domain, ref.index)).name
        else:
            name = self._schema_names(ref.layer, ref.domain, schema_index)[slot]
        return Placement(service, database, schema, name)

    def _compute_schema_names(self, layer: str, domain: int, schema_index: int) -> tuple[str, ...]:
        """Names of every table in one schema, made unique by counting repeats of a base name."""
        capacity = LAYER_BY_KEY[layer].capacity
        start = schema_index * capacity
        end = min(start + capacity, self.count(layer, domain))
        seen: Counter[str] = Counter()
        names = []
        for index in range(start, end):
            base = self._base_name(AssetRef(layer, domain, index))
            names.append(_variant(base, seen[base]))
            seen[base] += 1
        return tuple(names)

    def _base_name(self, ref: AssetRef) -> str:
        concept = self.concept(ref)
        if ref.layer == "source":
            return concept.plural
        if ref.layer == "staging":
            return f"stg_{concept.plural}"
        if ref.layer == "core":
            return f"dim_{_snake(concept.singular)}" if self.is_dim(ref) else f"fct_{concept.plural}"
        grain = MART_GRAINS[mix(self.seed, "grain", ref.domain, ref.index) % len(MART_GRAINS)]
        return f"mart_{concept.plural}_{grain}"

    def _service_level_placement(self, ref: AssetRef) -> Placement:
        spec = self.domains[ref.domain]
        concept = self.concept(ref)
        if ref.layer == "stream":
            source = self.placement(AssetRef("source", ref.domain, ref.index))
            system = source.service[len(self.prefix) + 1 :]
            name = f"{system}_{source.database}_{source.schema}_{source.name}"
            return Placement(self.kafka_service(ref.domain), None, None, name)
        if ref.layer == "bi_model":
            # The server names a data model <service>.model.<name>; "model" plays the database part.
            return Placement(
                self.service_name(spec.bi),
                DATA_MODEL_INFIX,
                None,
                f"{spec.name}_{concept.plural}_explore_{ref.index:05d}",
            )
        if ref.layer == "dashboard":
            return Placement(
                self.service_name(spec.bi),
                None,
                None,
                f"{spec.name}_{concept.plural}_dashboard_{ref.index:05d}",
            )
        ml_service = "sagemaker" if ref.index % 4 == 0 else "mlflow_prod"
        return Placement(
            self.service_name(ml_service),
            None,
            None,
            f"{spec.name}_{_snake(concept.singular)}_model_{ref.index:04d}",
        )

    def is_dim(self, ref: AssetRef) -> bool:
        return ref.layer == "core" and ref.index < self.dims(ref.domain)

    # ------------------------------------------------------------ lineage

    def primary_upstream(self, ref: AssetRef) -> AssetRef:
        return self.upstreams(ref)[0][0]

    def upstreams(self, ref: AssetRef) -> list[tuple[AssetRef, str | None]]:
        """(upstream asset, pipeline carrier key or None), primary first. Empty for sources.

        Only Fivetran and Airflow edges name their pipeline, as their connectors do; dbt lineage
        arrives without one. That also matters for load speed: the server projects an annotated
        edge onto refcounted service hops through the pipeline's service, so annotating every dbt
        model would funnel millions of writes into the same few rows.
        """
        handler = {
            "source": lambda: [],
            "stream": self._stream_upstreams,
            "raw": self._raw_upstreams,
            "staging": self._staging_upstreams,
            "core": self._core_upstreams,
            "mart": self._mart_upstreams,
            "bi_model": self._bi_model_upstreams,
            "dashboard": self._dashboard_upstreams,
            "ml_model": self._ml_upstreams,
        }[ref.layer]
        return handler(ref) if ref.layer != "source" else []

    def _stream_upstreams(self, ref: AssetRef) -> list[tuple[AssetRef, str | None]]:
        return [(AssetRef("source", ref.domain, ref.index), None)]

    def _raw_upstreams(self, ref: AssetRef) -> list[tuple[AssetRef, str | None]]:
        if ref.index < self.count("stream", ref.domain):
            return [(AssetRef("stream", ref.domain, ref.index), None)]
        return [(AssetRef("source", ref.domain, ref.index), "fivetran")]

    def _staging_upstreams(self, ref: AssetRef) -> list[tuple[AssetRef, str | None]]:
        raws = self.count("raw", ref.domain)
        picks = [AssetRef("raw", ref.domain, ref.index % raws)]
        if unit(self.seed, "stg-join", ref.domain, ref.index) < 0.1:
            picks.append(AssetRef("raw", ref.domain, self._zipf(raws, "stg", ref)))
        return [(pick, None) for pick in _distinct(picks)]

    def _core_upstreams(self, ref: AssetRef) -> list[tuple[AssetRef, str | None]]:
        stagings = self.count("staging", ref.domain)
        if self.is_dim(ref):
            return [(AssetRef("staging", ref.domain, self._zipf(stagings, "dim", ref)), None)]
        picks = [AssetRef("staging", ref.domain, ref.index % stagings)]
        extra = mix(self.seed, "fact-joins", ref.domain, ref.index) % 3
        picks += [
            AssetRef("staging", ref.domain, self._zipf(stagings, f"fact{n}", ref)) for n in range(extra)
        ]
        if unit(self.seed, "fact-dim", ref.domain, ref.index) < 0.6:
            picks.append(AssetRef("core", ref.domain, self._zipf(self.dims(ref.domain), "dimref", ref)))
        return [(pick, None) for pick in _distinct(picks)]

    def _mart_upstreams(self, ref: AssetRef) -> list[tuple[AssetRef, str | None]]:
        cores = self.count("core", ref.domain)
        picks = [AssetRef("core", ref.domain, self._zipf(cores, "mart", ref))]
        extra = mix(self.seed, "mart-joins", ref.domain, ref.index) % 3
        picks += [AssetRef("core", ref.domain, self._zipf(cores, f"mart{n}", ref)) for n in range(extra)]
        if unit(self.seed, "cross-domain", ref.domain, ref.index) < 0.1:
            other = (ref.domain + 1 + mix(self.seed, "other", ref.index) % (len(self.domains) - 1)) % len(
                self.domains
            )
            picks.append(AssetRef("core", other, self._zipf(self.dims(other), "xdim", ref)))
        return [(pick, None) for pick in _distinct(picks)]

    def _bi_model_upstreams(self, ref: AssetRef) -> list[tuple[AssetRef, str | None]]:
        marts = self.count("mart", ref.domain)
        picks = [AssetRef("mart", ref.domain, self._zipf(marts, "bi", ref))]
        if unit(self.seed, "bi-join", ref.domain, ref.index) < 0.3:
            picks.append(AssetRef("mart", ref.domain, self._zipf(marts, "bi2", ref)))
        return [(pick, None) for pick in _distinct(picks)]

    def _dashboard_upstreams(self, ref: AssetRef) -> list[tuple[AssetRef, str | None]]:
        models = self.count("bi_model", ref.domain)
        if models == 0:
            return [
                (AssetRef("mart", ref.domain, self._zipf(self.count("mart", ref.domain), "dash", ref)), None)
            ]
        picks = [AssetRef("bi_model", ref.domain, self._zipf(models, "dash", ref))]
        if unit(self.seed, "dash-join", ref.domain, ref.index) < 0.3:
            picks.append(AssetRef("bi_model", ref.domain, self._zipf(models, "dash2", ref)))
        return [(pick, None) for pick in _distinct(picks)]

    def _ml_upstreams(self, ref: AssetRef) -> list[tuple[AssetRef, str | None]]:
        cores = self.count("core", ref.domain)
        picks = [AssetRef("core", ref.domain, self._zipf(cores, f"ml{n}", ref)) for n in range(2)]
        picks.append(AssetRef("mart", ref.domain, self._zipf(self.count("mart", ref.domain), "ml-mart", ref)))
        return [(pick, "airflow_prod") for pick in _distinct(picks)]

    def _zipf(self, candidates: int, salt: str, ref: AssetRef) -> int:
        """Skewed towards low indices, so a few assets become hubs with thousands of consumers."""
        drawn = unit(self.seed, salt, ref.layer, ref.domain, ref.index)
        return min(candidates - 1, int(candidates * drawn**ZIPF_ALPHA))

    def edges(self, ref: AssetRef) -> list[Edge]:
        source_kind = {
            "stream": "PipelineLineage",
            "raw": "PipelineLineage",
            "staging": "DbtLineage",
            "core": "DbtLineage",
            "mart": "DbtLineage",
            "bi_model": "DashboardLineage",
            "dashboard": "DashboardLineage",
            "ml_model": "PipelineLineage",
        }.get(ref.layer, "Manual")
        return [Edge(upstream, ref, carrier, source_kind) for upstream, carrier in self.upstreams(ref)]

    def pipelines(self) -> list[tuple[str, str, str, str]]:
        """(service key, pipeline name, description, domain name) — the edge carriers."""
        found = []
        for domain in self.domains:
            for system in domain.systems:
                found.append(
                    (
                        "fivetran",
                        f"{domain.name}_{system.name}_connector",
                        f"Fivetran connector replicating {system.name} into the {domain.display} raw schemas every 15 minutes.",
                        domain.name,
                    )
                )
            for layer in ("staging", "core", "mart"):
                found.append(
                    (
                        "dbt_cloud",
                        f"{domain.name}_{layer}_models",
                        f"dbt Cloud job building the {domain.display} {layer} models, nightly at 02:00 UTC.",
                        domain.name,
                    )
                )
            found.append(
                (
                    "airflow_prod",
                    f"{domain.name}_ml_training",
                    f"Airflow DAG retraining {domain.display} models weekly and publishing predictions.",
                    domain.name,
                )
            )
        return found

    def carrier_pipeline(self, edge: Edge) -> tuple[str, str] | None:
        """(pipeline service key, pipeline name) for an edge with a carrier."""
        if edge.carrier is None:
            return None
        domain = self.domains[edge.downstream.domain]
        if edge.carrier == "fivetran":
            system = self.placement(edge.upstream).service[len(self.prefix) + 1 :]
            return "fivetran", f"{domain.name}_{system}_connector"
        return "airflow_prod", f"{domain.name}_ml_training"

    # ------------------------------------------------------------ columns

    def columns(self, ref: AssetRef) -> list[Column]:
        concept = self.concept(ref)
        domain = self.domains[ref.domain]
        builder = {
            "source": lambda: _source_columns(concept, domain),
            "stream": lambda: _source_columns(concept, domain) + _cdc_fields(),
            "raw": lambda: _source_columns(concept, domain) + _landing_columns(),
            "staging": lambda: _business_columns(concept, domain) + [_LOADED_AT],
            "core": lambda: self._core_columns(ref, concept, domain),
            "mart": lambda: _mart_columns(concept, domain),
            "bi_model": lambda: _mart_columns(self.concept(self.primary_upstream(ref)), domain),
        }.get(ref.layer)
        return _unique(builder()) if builder else []

    def _core_columns(self, ref: AssetRef, concept: Concept, domain: Domain) -> list[Column]:
        columns = _business_columns(concept, domain)
        if self.is_dim(ref):
            return columns + _SCD_COLUMNS
        names = {column.name for column in columns}
        for upstream, _ in self.upstreams(ref)[1:]:
            joined = self.concept(upstream)
            key = f"{_snake(joined.singular)}_id"
            if key not in names:
                columns.append(_foreign_key(joined.singular, joined.plural, concept, domain))
                names.add(key)
        return columns + [_DBT_UPDATED_AT]

    def column_lineage(self, edge: Edge) -> list[tuple[list[str], str, str | None]]:
        """(from column FQNs, to column FQN, function) for an edge, matched by column name."""
        downstream_columns = self.columns(edge.downstream)
        upstream_columns = {column.name: column for column in self.columns(edge.upstream)}
        if not downstream_columns or not upstream_columns:
            return []
        upstream_fqn = self.placement(edge.upstream).fqn
        downstream_fqn = self.placement(edge.downstream).fqn
        # Aggregates come from the table a mart is built over; a joined table only feeds columns
        # it shares by name.
        aggregates = edge.upstream == self.primary_upstream(edge.downstream)
        mappings = []
        for column in downstream_columns:
            source_name, function = _derivation(
                column.name, edge.downstream.layer, upstream_columns, aggregates
            )
            if source_name is not None:
                mappings.append(
                    ([f"{upstream_fqn}.{source_name}"], f"{downstream_fqn}.{column.name}", function)
                )
        return mappings[:MAX_COLUMN_LINEAGE]

    def sql(self, edge: Edge) -> str | None:
        """A short, plausible transformation for the edge panel; None where none would exist."""
        if edge.downstream.layer not in ("staging", "core", "mart"):
            return None
        upstream = self.placement(edge.upstream)
        downstream = self.placement(edge.downstream)
        columns = [column.name for column in self.columns(edge.downstream)][:SQL_PREVIEW_COLUMNS]
        return f"INSERT INTO {downstream.fqn} SELECT {', '.join(columns)}, ... FROM {upstream.fqn}"


# ---------------------------------------------------------------- naming helpers


def _numbered(names: tuple[str, ...], position: int) -> str:
    base = names[position % len(names)]
    lap = position // len(names)
    return base if lap == 0 else f"{base}_{lap + 1}"


def _variant(base: str, occurrence: int) -> str:
    if occurrence == 0:
        return base
    qualifier = QUALIFIERS[(occurrence - 1) % len(QUALIFIERS)]
    lap = (occurrence - 1) // len(QUALIFIERS)
    return f"{base}_{qualifier}" + (f"_{lap + 1}" if lap else "")


def _snake(text: str) -> str:
    return text.lower().replace(" ", "_")


def _distinct(refs: list[AssetRef]) -> list[AssetRef]:
    return list(dict.fromkeys(refs))


def _unique(columns: list[Column]) -> list[Column]:
    """A concept may define a column the layer also adds, e.g. created_at; keep the first."""
    seen: set[str] = set()
    unique = []
    for column in columns:
        if column.name not in seen:
            seen.add(column.name)
            unique.append(column)
    return unique


# ---------------------------------------------------------------- column helpers


def _describe(attribute_name: str, kind: str, entity: str, domain: Domain, examples: str = "") -> str:
    label = attribute_name.replace("_", " ")
    if label.startswith(entity + " "):
        label = label[len(entity) + 1 :]
    if kind == "date" and attribute_name.endswith("_on"):
        return f"Date the {entity} was {attribute_name.removesuffix('_on').replace('_', ' ')} (UTC)."
    return KINDS[kind][2].format(
        Label=label[:1].upper() + label[1:],
        label_lower=label,
        entity=entity,
        domain=domain.display,
        examples=examples or "the values defined by the source system",
        verb=attribute_name.removesuffix("_at").replace("_", " "),
        flag_phrase=label if label.startswith(("is ", "has ")) else f"has {label}",
    )


def _column(name: str, kind: str, description: str) -> Column:
    data_type, size, _, tag = KINDS[kind]
    if isinstance(size, tuple):
        return Column(name, data_type, description, precision=size, tag=tag)
    return Column(name, data_type, description, length=size, tag=tag)


def _primary_key(concept: Concept, domain: Domain) -> Column:
    system = domain.systems[0].name
    return Column(
        f"{_snake(concept.singular)}_id",
        "BIGINT",
        f"Primary key of the {concept.singular}: a surrogate id assigned by the {system} application and never reused.",
    )


def _foreign_key(singular: str, plural: str, concept: Concept, domain: Domain) -> Column:
    return Column(
        f"{_snake(singular)}_id",
        "BIGINT",
        f"The {singular} this {concept.singular} belongs to; joins to {plural}.{_snake(singular)}_id.",
    )


def _attribute_columns(concept: Concept, domain: Domain) -> list[Column]:
    return [
        _column(
            attribute.name,
            attribute.kind,
            _describe(attribute.name, attribute.kind, concept.singular, domain, attribute.examples),
        )
        for attribute in concept.attributes
    ]


def _business_columns(concept: Concept, domain: Domain) -> list[Column]:
    keys = [_primary_key(concept, domain)]
    keys += [_foreign_key(ref, f"{ref}s", concept, domain) for ref in concept.refs]
    return keys + _attribute_columns(concept, domain)


def _source_columns(concept: Concept, domain: Domain) -> list[Column]:
    return _business_columns(concept, domain) + [
        Column("created_at", "TIMESTAMP", "Time the row was inserted in the source database, in UTC."),
        Column("updated_at", "TIMESTAMP", "Time the row was last modified in the source database, in UTC."),
    ]


def _cdc_fields() -> list[Column]:
    return [
        Column(
            "__op",
            "VARCHAR",
            "Debezium operation: c = insert, u = update, d = delete, r = snapshot read.",
            length=1,
        ),
        Column(
            "__source_ts_ms",
            "BIGINT",
            "Commit time of the change in the source database, epoch milliseconds.",
        ),
        Column("__deleted", "BOOLEAN", "True on the tombstone message emitted for a delete."),
    ]


def _landing_columns() -> list[Column]:
    return [
        Column("_ingested_at", "TIMESTAMP", "Time the row landed in the warehouse, in UTC."),
        Column(
            "_cdc_operation",
            "CHAR",
            "Change type that produced the row: c = insert, u = update, d = delete.",
            length=1,
        ),
        Column(
            "_source_offset", "BIGINT", "Position of the change in the CDC stream (Kafka offset or WAL LSN)."
        ),
    ]


_LOADED_AT = Column("_loaded_at", "TIMESTAMP", "Time dbt built this row, in UTC.")
_DBT_UPDATED_AT = Column("dbt_updated_at", "TIMESTAMP", "Time the row was last rebuilt by dbt, in UTC.")
_SCD_COLUMNS = [
    Column("valid_from", "TIMESTAMP", "Start of the period this version of the row was current, in UTC."),
    Column(
        "valid_to", "TIMESTAMP", "End of the period this version was current; NULL for the current version."
    ),
    Column(
        "is_current", "BOOLEAN", "True for the latest version of each record; filter on it for current state."
    ),
]


def _mart_columns(concept: Concept, domain: Domain) -> list[Column]:
    columns = [
        Column("report_date", "DATE", "Calendar day (UTC) the metrics in this row are aggregated over.")
    ]
    categories = [a for a in concept.attributes if a.kind in ("category", "status", "country")][:2]
    columns += [
        _column(a.name, a.kind, _describe(a.name, a.kind, concept.singular, domain, a.examples))
        for a in categories
    ]
    columns.append(
        Column(f"{concept.plural}_count", "BIGINT", f"Number of distinct {concept.plural} in the group.")
    )
    amounts = [a for a in concept.attributes if a.kind == "amount"]
    for attribute in amounts:
        label = attribute.name.replace("_", " ")
        columns.append(
            Column(
                f"total_{attribute.name}",
                "DECIMAL",
                f"Sum of {label} over the group's {concept.plural}.",
                precision=(20, 2),
            )
        )
    if amounts:
        first = amounts[0].name
        columns.append(
            Column(
                f"avg_{first}",
                "DECIMAL",
                f"Average {first.replace('_', ' ')} per {concept.singular} in the group.",
                precision=(20, 4),
            )
        )
    return columns


def _derivation(
    name: str, layer: str, upstream: dict[str, Column], aggregates: bool
) -> tuple[str | None, str | None]:
    """Which upstream column a downstream column comes from, and through what function."""
    if name in upstream:
        return name, None
    if aggregates and layer in ("mart", "bi_model"):
        if name.startswith("total_") and name[6:] in upstream:
            return name[6:], f"SUM({name[6:]})"
        if name.startswith("avg_") and name[4:] in upstream:
            return name[4:], f"AVG({name[4:]})"
        if name.endswith("_count"):
            key = next((column for column in upstream if column.endswith("_id")), None)
            return key, f"COUNT(DISTINCT {key})" if key else None
        if name == "report_date":
            stamp = next((c.name for c in upstream.values() if c.data_type in ("TIMESTAMP", "DATE")), None)
            return stamp, f"CAST({stamp} AS DATE)" if stamp else None
    return None, None
