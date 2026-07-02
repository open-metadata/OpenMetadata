from unittest.mock import MagicMock, patch
from uuid import uuid4

from metadata.generated.schema.entity.teams.team import Team, TeamType
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.metadataIngestion.pipelineServiceMetadataPipeline import (
    OwnershipUpdateMode,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.source.pipeline.openlineage.ownership_resolver import (
    OpenLineageOwnerResolver,
)


def build_user(
    name: str,
    display_name: str | None = None,
    owns: list[EntityReference] | None = None,
) -> User:
    return User(
        id=uuid4(),
        name=name,
        displayName=display_name,
        email=f"{name}@example.com",
        owns=EntityReferenceList(root=owns) if owns else None,
    )


def build_team(
    name: str,
    display_name: str | None = None,
    team_type: TeamType = TeamType.Group,
    owns: list[EntityReference] | None = None,
) -> Team:
    return Team(
        id=uuid4(),
        name=name,
        teamType=team_type,
        displayName=display_name,
        owns=EntityReferenceList(root=owns) if owns else None,
    )


def build_resolver(
    users=None,
    teams=None,
    include_owners=True,
    ownership_update_mode=OwnershipUpdateMode.replace,
):
    metadata = MagicMock()

    def list_all_entities(entity, **_):
        if entity is User:
            return users or []
        if entity is Team:
            return teams or []
        return []

    metadata.list_all_entities.side_effect = list_all_entities
    return (
        OpenLineageOwnerResolver(
            metadata,
            include_owners=include_owners,
            ownership_update_mode=ownership_update_mode,
        ),
        metadata,
    )


def build_job(owner_names):
    return {"facets": {"ownership": {"owners": [{"name": owner_name} for owner_name in owner_names]}}}


def test_resolves_qualified_user_and_team_owner_names():
    user = build_user("jdoe", "John Doe")
    team = build_team("data-platform", "Data Platform")
    resolver, _ = build_resolver(users=[user], teams=[team])

    owners = resolver.get_pipeline_job_owners(build_job(["user:jdoe", "team:data-platform"]))

    assert owners is not None
    assert [(owner.type, owner.name) for owner in owners.root] == [
        ("user", "jdoe"),
        ("team", "data-platform"),
    ]


def test_unqualified_owner_prefers_group_team_over_user():
    user = build_user("analytics")
    team = build_team("analytics")
    resolver, _ = build_resolver(users=[user], teams=[team])

    with patch("metadata.ingestion.source.pipeline.openlineage.ownership_resolver.logger.warning") as warning:
        owners = resolver.get_pipeline_job_owners(build_job(["analytics"]))

    assert owners is not None
    assert len(owners.root) == 1
    assert owners.root[0].type == "team"
    assert owners.root[0].name == "analytics"
    warning.assert_called_once_with(
        "OpenLineage owner [analytics] matched both a team and a user. Using the team for pipeline ownership."
    )


def test_only_caches_group_teams():
    department = build_team("finance", team_type=TeamType.Department)
    resolver, _ = build_resolver(teams=[department])

    with patch("metadata.ingestion.source.pipeline.openlineage.ownership_resolver.logger.warning") as warning:
        owners = resolver.get_pipeline_job_owners(build_job(["team:finance"]))

    assert owners is None
    warning.assert_called_once_with("Unable to resolve OpenLineage owner [team:finance] for pipeline ownership.")


def test_does_not_build_cache_without_ownership_facet():
    resolver, metadata = build_resolver()

    owners = resolver.get_pipeline_job_owners({"name": "job"})

    assert owners is None
    metadata.list_all_entities.assert_not_called()


def test_does_not_build_cache_when_include_owners_is_disabled():
    resolver, metadata = build_resolver(
        users=[build_user("jdoe")],
        teams=[build_team("data-platform")],
        include_owners=False,
    )

    owners = resolver.get_pipeline_job_owners(build_job(["user:jdoe", "team:data-platform"]))

    assert owners is None
    metadata.list_all_entities.assert_not_called()


def test_does_not_build_cache_when_include_owners_is_none():
    resolver, metadata = build_resolver(
        users=[build_user("jdoe")],
        teams=[build_team("data-platform")],
        include_owners=None,
    )

    owners = resolver.get_pipeline_job_owners(build_job(["user:jdoe", "team:data-platform"]))

    assert owners is None
    metadata.list_all_entities.assert_not_called()


def test_builds_pipeline_owner_cache_with_filtered_owns_api():
    pipeline_ref = EntityReference(
        id=uuid4(),
        type="pipeline",
        name="daily_orders",
        fullyQualifiedName="airflow.daily_orders",
    )
    user = build_user("jdoe", owns=[pipeline_ref])
    team = build_team("data-platform", owns=[pipeline_ref])
    resolver, metadata = build_resolver(users=[user], teams=[team])

    resolver.get_pipeline_job_owners(build_job(["team:data-platform"]))

    metadata.list_all_entities.assert_any_call(
        entity=Team,
        fields=["teamType", "owns"],
        limit=1000,
        params={"ownsEntityType": "pipeline"},
        skip_on_failure=True,
    )
    metadata.list_all_entities.assert_any_call(
        entity=User,
        fields=["owns"],
        limit=1000,
        params={"ownsEntityType": "pipeline", "directOwnsOnly": "true"},
        skip_on_failure=True,
    )


def test_replace_mode_does_not_carry_existing_pipeline_owners():
    pipeline_ref = EntityReference(
        id=uuid4(),
        type="pipeline",
        name="daily_orders",
        fullyQualifiedName="airflow.daily_orders",
    )
    existing_team = build_team("data-platform", owns=[pipeline_ref])
    new_user = build_user("jdoe")
    resolver, _ = build_resolver(
        users=[new_user],
        teams=[existing_team],
        ownership_update_mode="replace",
    )

    owners = resolver.get_pipeline_job_owners(
        build_job(["user:jdoe"]),
        pipeline_fqn="airflow.daily_orders",
    )

    assert owners is not None
    assert [(owner.type, owner.name) for owner in owners.root] == [("user", "jdoe")]


def test_none_ownership_update_mode_defaults_to_replace():
    pipeline_ref = EntityReference(
        id=uuid4(),
        type="pipeline",
        name="daily_orders",
        fullyQualifiedName="airflow.daily_orders",
    )
    existing_team = build_team("data-platform", owns=[pipeline_ref])
    new_user = build_user("jdoe")
    resolver, _ = build_resolver(
        users=[new_user],
        teams=[existing_team],
        ownership_update_mode=None,
    )

    owners = resolver.get_pipeline_job_owners(
        build_job(["user:jdoe"]),
        pipeline_fqn="airflow.daily_orders",
    )

    assert owners is not None
    assert [(owner.type, owner.name) for owner in owners.root] == [("user", "jdoe")]


def test_append_mode_merges_existing_pipeline_owners_and_updates_cache():
    pipeline_ref = EntityReference(
        id=uuid4(),
        type="pipeline",
        name="daily_orders",
        fullyQualifiedName="airflow.daily_orders",
    )
    user = build_user("jdoe")
    team = build_team("data-platform", owns=[pipeline_ref])
    resolver, _ = build_resolver(
        users=[user],
        teams=[team],
        ownership_update_mode="append",
    )

    owners = resolver.get_pipeline_job_owners(
        build_job(["user:jdoe"]),
        pipeline_fqn="airflow.daily_orders",
    )

    assert owners is not None
    assert [(owner.type, owner.name) for owner in owners.root] == [
        ("team", "data-platform"),
        ("user", "jdoe"),
    ]
    assert [(owner.type, owner.name) for owner in resolver._owner_refs_by_pipeline_fqn["airflow.daily_orders"]] == [
        ("team", "data-platform"),
        ("user", "jdoe"),
    ]
