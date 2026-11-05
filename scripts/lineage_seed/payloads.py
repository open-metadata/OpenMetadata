"""Create-request bodies for every entity the seed writes, built from the catalog model."""

from __future__ import annotations

from typing import Any

from catalog import (
    AssetRef,
    Catalog,
    Column,
    Edge,
)
from vocabulary import BI_SERVICES, Domain

TOPIC_FIELD_TYPES = {
    "BIGINT": "LONG",
    "INT": "INT",
    "DOUBLE": "DOUBLE",
    "DECIMAL": "DOUBLE",
    "BOOLEAN": "BOOLEAN",
    "TIMESTAMP": "TIMESTAMP",
    "DATE": "DATE",
}
TIER_BY_LAYER = {"raw": "Tier.Tier4", "staging": "Tier.Tier3", "core": "Tier.Tier2", "mart": "Tier.Tier2"}
HUB_TIER = "Tier.Tier1"
TABLE_TYPE_BY_LAYER = {"staging": "View", "mart": "MaterializedView"}
DATA_PRODUCT_LAYERS = frozenset({"core", "mart", "bi_model", "dashboard", "ml_model"})
DASHBOARD_KINDS = ("overview", "performance", "deep dive", "weekly review", "health")
ML_TARGETS = ("churn", "propensity", "anomaly", "forecast", "segmentation")


def tag(fqn: str) -> dict[str, str]:
    return {"tagFQN": fqn, "source": "Classification", "labelType": "Manual", "state": "Confirmed"}


class Payloads:
    """`team_ids` maps a domain name to its owning team's id, created before any asset."""

    def __init__(self, catalog: Catalog, team_ids: dict[str, str]) -> None:
        self.catalog = catalog
        self.team_ids = team_ids

    # ------------------------------------------------------------ governance roots

    def domain_fqn(self, domain: Domain) -> str:
        return self.catalog.service_name(domain.name)

    def data_product_fqn(self, name: str) -> str:
        return self.catalog.service_name(name)

    def owners(self, domain: Domain) -> list[dict[str, str]]:
        return [{"id": self.team_ids[domain.name], "type": "team"}]

    def team(self, domain: Domain) -> dict[str, Any]:
        return {
            "name": self.catalog.service_name(f"{domain.name}_team"),
            "displayName": domain.team,
            "teamType": "Group",
            "description": f"Owns the {domain.display} domain's data products, models and dashboards.",
        }

    def domain(self, domain: Domain) -> dict[str, Any]:
        return {
            "name": self.domain_fqn(domain),
            "displayName": domain.display,
            "domainType": domain.domain_type,
            "description": domain.description,
            "owners": self.owners(domain),
        }

    def data_product(self, domain: Domain, name: str, description: str) -> dict[str, Any]:
        return {
            "name": self.data_product_fqn(name),
            "displayName": name.replace("_", " ").title(),
            "description": description,
            "domains": [self.domain_fqn(domain)],
            "owners": self.owners(domain),
        }

    # ------------------------------------------------------------ containers

    def database(
        self, service: str, database: str, description: str, domain: Domain | None
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"name": database, "service": service, "description": description}
        if domain is not None:
            body["domains"] = [self.domain_fqn(domain)]
            body["owners"] = self.owners(domain)
        return body

    def schema(self, service: str, database: str, schema: str, domain: Domain, layer: str) -> dict[str, Any]:
        return {
            "name": schema,
            "database": f"{service}.{database}",
            "description": _schema_description(schema, domain, layer),
            "domains": [self.domain_fqn(domain)],
            "owners": self.owners(domain),
        }

    # ------------------------------------------------------------ assets

    def table(self, ref: AssetRef) -> dict[str, Any]:
        catalog = self.catalog
        placement = catalog.placement(ref)
        domain = catalog.domains[ref.domain]
        body: dict[str, Any] = {
            "name": placement.name,
            "databaseSchema": placement.container_fqn,
            "tableType": TABLE_TYPE_BY_LAYER.get(ref.layer, "Regular"),
            "description": self._table_description(ref),
            "columns": [_table_column(column) for column in catalog.columns(ref)],
            "owners": self.owners(domain),
            "domains": [self.domain_fqn(domain)],
        }
        self._add_governance(ref, body)
        if ref.layer == "staging":
            primary = catalog.primary_upstream(ref)
            body["schemaDefinition"] = (
                catalog.sql(catalog.edges(ref)[0]) or f"SELECT * FROM {catalog.placement(primary).fqn}"
            )
        return body

    def topic(self, ref: AssetRef) -> dict[str, Any]:
        placement = self.catalog.placement(ref)
        domain = self.catalog.domains[ref.domain]
        source = self.catalog.placement(AssetRef("source", ref.domain, ref.index))
        return {
            "name": placement.name,
            "service": placement.service,
            "partitions": 12,
            "replicationFactor": 3,
            "retentionTime": 604800000,
            "cleanupPolicies": ["delete"],
            "description": f"Debezium change stream of `{source.fqn}`: one message per insert, update or delete, retained for 7 days.",
            "messageSchema": {
                "schemaType": "Avro",
                "schemaFields": [_topic_field(column) for column in self.catalog.columns(ref)],
            },
            "owners": self.owners(domain),
            "domains": [self.domain_fqn(domain)],
        }

    def data_model(self, ref: AssetRef) -> dict[str, Any]:
        placement = self.catalog.placement(ref)
        domain = self.catalog.domains[ref.domain]
        mart = self.catalog.placement(self.catalog.primary_upstream(ref))
        model_type = BI_SERVICES[domain.bi][1]
        body = {
            "name": placement.name,
            "displayName": placement.name.replace("_", " ").title(),
            "service": placement.service,
            "dataModelType": model_type,
            "description": f"Semantic model over `{mart.fqn}` that {domain.display} dashboards query.",
            "columns": [_table_column(column) for column in self.catalog.columns(ref)],
            "owners": self.owners(domain),
            "domains": [self.domain_fqn(domain)],
        }
        self._add_governance(ref, body)
        return body

    def dashboard(self, ref: AssetRef) -> dict[str, Any]:
        placement = self.catalog.placement(ref)
        domain = self.catalog.domains[ref.domain]
        concept = self.catalog.concept(ref)
        kind = DASHBOARD_KINDS[ref.index % len(DASHBOARD_KINDS)]
        body = {
            "name": placement.name,
            "displayName": f"{domain.display} · {concept.plural.replace('_', ' ').capitalize()} {kind}",
            "service": placement.service,
            "dashboardType": "Dashboard",
            "description": (
                f"{kind.capitalize()} of {domain.display} {concept.plural.replace('_', ' ')}: volumes, "
                f"amounts and trends against last period. Reviewed in the weekly {domain.display} business review."
            ),
            "owners": self.owners(domain),
            "domains": [self.domain_fqn(domain)],
        }
        self._add_governance(ref, body)
        return body

    def ml_model(self, ref: AssetRef) -> dict[str, Any]:
        placement = self.catalog.placement(ref)
        domain = self.catalog.domains[ref.domain]
        concept = self.catalog.concept(ref)
        target = ML_TARGETS[ref.index % len(ML_TARGETS)]
        body = {
            "name": placement.name,
            "displayName": f"{concept.singular.capitalize()} {target} model",
            "service": placement.service,
            "algorithm": "GradientBoostedTrees",
            "description": (
                f"Predicts {target} for each {concept.singular} from curated {domain.display} features. "
                "Retrained weekly by Airflow; batch scores land in the domain's marts."
            ),
            "owners": self.owners(domain),
            "domains": [self.domain_fqn(domain)],
        }
        self._add_governance(ref, body)
        return body

    def pipeline(self, service_key: str, name: str, description: str, domain: Domain) -> dict[str, Any]:
        return {
            "name": name,
            "service": self.catalog.service_name(service_key),
            "description": description,
            "owners": self.owners(domain),
            "domains": [self.domain_fqn(domain)],
        }

    def _add_governance(self, ref: AssetRef, body: dict[str, Any]) -> None:
        domain = self.catalog.domains[ref.domain]
        if ref.layer in DATA_PRODUCT_LAYERS and domain.data_products:
            product = domain.data_products[ref.index % len(domain.data_products)][0]
            body["dataProducts"] = [self.data_product_fqn(product)]
        tier = HUB_TIER if self.catalog.is_dim(ref) else TIER_BY_LAYER.get(ref.layer)
        if tier is not None:
            body["tags"] = [tag(tier)]

    def _table_description(self, ref: AssetRef) -> str:
        catalog = self.catalog
        domain = catalog.domains[ref.domain]
        concept = catalog.concept(ref)
        plural = concept.plural.replace("_", " ")
        if ref.layer == "source":
            system = catalog.placement(ref).service[len(catalog.prefix) + 1 :]
            return (
                f"Operational table of the {system} application: one row per {concept.singular}. "
                f"Written by the application and replicated to the warehouse for {domain.display} analytics."
            )
        upstream = catalog.placement(catalog.primary_upstream(ref)).fqn
        if ref.layer == "raw":
            return (
                f"Raw copy of `{upstream}` as landed by the CDC pipeline. Append-only history of every "
                "change; columns starting with an underscore are load metadata."
            )
        if ref.layer == "staging":
            return (
                f"Cleaned {plural} from `{upstream}`: deduplicated on the primary key, typed, timestamps "
                "normalised to UTC and soft-deleted rows removed. Built by dbt."
            )
        if catalog.is_dim(ref):
            return (
                f"Type 2 slowly changing dimension of {plural}, one row per version. Filter on "
                f"is_current for the latest state. Joined by most {domain.display} facts and marts."
            )
        if ref.layer == "core":
            return (
                f"Fact table of {plural} at one row per {concept.singular}, joined to its dimensions. "
                f"The governed source for {domain.display} reporting; built nightly from `{upstream}`."
            )
        return (
            f"Aggregated {plural} metrics for the {domain.display} team, refreshed daily at 06:00 UTC "
            f"from `{upstream}`. Feeds dashboards and reverse ETL."
        )

    # ------------------------------------------------------------ lineage

    def lineage_details(self, edge: Edge, pipeline_ids: dict[str, str]) -> dict[str, Any]:
        details: dict[str, Any] = {"source": edge.source}
        mappings = self.catalog.column_lineage(edge)
        if mappings:
            details["columnsLineage"] = [
                {"fromColumns": sources, "toColumn": target, **({"function": function} if function else {})}
                for sources, target, function in mappings
            ]
        sql = self.catalog.sql(edge)
        if sql:
            details["sqlQuery"] = sql
        carrier = self.catalog.carrier_pipeline(edge)
        if carrier is not None:
            pipeline_fqn = f"{self.catalog.service_name(carrier[0])}.{carrier[1]}"
            if pipeline_fqn in pipeline_ids:
                details["pipeline"] = {"id": pipeline_ids[pipeline_fqn], "type": "pipeline"}
        return details


def _table_column(column: Column) -> dict[str, Any]:
    body: dict[str, Any] = {
        "name": column.name,
        "dataType": column.data_type,
        "description": column.description,
    }
    if column.length is not None:
        body["dataLength"] = column.length
    if column.precision is not None:
        body["precision"], body["scale"] = column.precision
    if column.data_type in ("VARCHAR", "CHAR") and column.length is None:
        body["dataLength"] = 255
    if column.tag is not None:
        body["tags"] = [tag(column.tag)]
    return body


def _topic_field(column: Column) -> dict[str, Any]:
    body: dict[str, Any] = {
        "name": column.name,
        "dataType": TOPIC_FIELD_TYPES.get(column.data_type, "STRING"),
        "description": column.description,
    }
    if column.tag is not None:
        body["tags"] = [tag(column.tag)]
    return body


def _schema_description(schema: str, domain: Domain, layer: str) -> str:
    subject = schema.replace("_", " ")
    return {
        "source": f"`{schema}` schema of a {domain.display} operational database.",
        "raw": f"Landing schema for the `{schema}` connector: one table per replicated source table.",
        "staging": f"dbt staging models for {domain.display} {subject}.",
        "core": f"{domain.display} {subject}: governed dimensions and facts.",
        "mart": f"{domain.display} {subject} marts for dashboards and reverse ETL.",
    }[layer]
