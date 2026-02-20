from typing import Optional


def get_source_tables(lineage: dict) -> set:
    table_id = lineage["entity"]["id"]

    # upstream edges
    source_tables = set()
    for upstream_edge in lineage["upstreamEdges"]:
        if not upstream_edge["toEntity"] == table_id:
            continue

        source_table_id = upstream_edge["fromEntity"]
        for node in lineage["nodes"]:
            if node["id"] == source_table_id:
                source_tables.add(node["name"])

    return source_tables


def get_target_tables(lineage: dict) -> set:
    table_id = lineage["entity"]["id"]

    # downstream edges
    target_tables = set()
    for downstream_edge in lineage["downstreamEdges"]:
        if not downstream_edge["fromEntity"] == table_id:
            continue

        target_table_id = downstream_edge["toEntity"]
        for node in lineage["nodes"]:
            if node["id"] == target_table_id:
                target_tables.add(node["name"])

    return target_tables


def assert_lineage_sources(
    lineage: dict, expected_source_tables: Optional[set[str]]
) -> None:
    if expected_source_tables is None:
        return

    source_tables = get_source_tables(lineage)
    assert source_tables == expected_source_tables, (
        f"\n\tTarget: {lineage['entity']['name']}"
        f"\n\t- Expected sources: {expected_source_tables}"
        f"\n\t- Actual sources: {source_tables}"
    )


def assert_lineage_targets(
    lineage: dict, expected_target_tables: Optional[set[str]]
) -> None:
    if expected_target_tables is None:
        return

    target_tables = get_target_tables(lineage)
    assert target_tables == expected_target_tables, (
        f"\n\tSource: {lineage['entity']['name']}"
        f"\n\t- Expected targets: {expected_target_tables}"
        f"\n\t- Actual targets: {target_tables}"
    )


def assert_column_lineage(
    lineage: dict, expected_column_lineage: Optional[list[tuple[str, str]]]
) -> None:
    if expected_column_lineage is None:
        return

    actual_column_lineage = []
    for edge in lineage.get("columnLineage", []):
        from_column = edge["fromColumn"]["name"]
        to_column = edge["toColumn"]["name"]
        actual_column_lineage.append((from_column, to_column))

    assert set(actual_column_lineage) == set(
        expected_column_lineage
    ), f"Expected column lineage: {expected_column_lineage}, but got: {actual_column_lineage}"


def assert_lineage(
    lineage: dict,
    expected_source_tables: Optional[set[str]],
    expected_target_tables: Optional[set[str]],
    expected_column_lineage: Optional[list[tuple[str, str]]],
) -> None:
    # check if lineage is present
    assert lineage is not None, "Lineage object is None"

    # check all lineage components
    assert_lineage_sources(lineage, expected_source_tables)
    assert_lineage_targets(lineage, expected_target_tables)
    assert_column_lineage(lineage, expected_column_lineage)


def print_lineage(lineage: dict) -> None:
    print("Lineage Nodes:")
    for node in lineage["nodes"]:
        print(f" - {node['id']}: {node['name']}")

    print("\nUpstream Edges:")
    for edge in lineage["upstreamEdges"]:
        print(
            f" - From {edge['fromEntity']['name']} to {edge['toEntity']['name']} (Edge ID: {edge['id']})"
        )

    print("\nDownstream Edges:")
    for edge in lineage["downstreamEdges"]:
        print(
            f" - From {edge['fromEntity']['name']} to {edge['toEntity']['name']} (Edge ID: {edge['id']})"
        )
    print("\n")
