#!/usr/bin/env python3
"""Compares the alert catalog with what every release since 1.3.0 offered.

An alert saved years ago may name a source, a filter or a trigger that is no longer offered.
Such an alert must still build, so the catalog only grows: what is no longer offered stays in
AlertCatalog.json, marked as removed. This script reads the catalog files of every release tag
(1.3.0 deleted all earlier alerts, so nothing older can be stored) and answers two questions.

    python3 scripts/alerting/check_alert_catalog_against_releases.py
        What did a release offer that AlertCatalog.json does not hold at all, removed or not?
        The answer must be an empty list. Anything listed has to be added back as removed.

    python3 scripts/alerting/check_alert_catalog_against_releases.py --shipped
        Everything any release offered, as the fixture that
        AlertCatalogTest.everyShippedDefinitionStillBuilds builds alerts from. Write it to
        openmetadata-service/src/test/resources/compat/alert-catalog-shipped-entries.json

Run it from a clone that has the release tags; CI checkouts carry none, which is why the
fixture is checked in rather than computed during a build. When a release is cut, run both.
"""
import json
import re
import subprocess
import sys

DATA = "openmetadata-service/src/main/resources/json/data/"
NOTIFICATION_SOURCES = DATA + "EventSubResourceDescriptor.json"
NOTIFICATION_FILTERS = DATA + "FilterFunctionsDescriptor.json"
OBSERVABILITY = DATA + "EntityObservabilityFilterDescriptor.json"
CATALOG = DATA + "AlertCatalog.json"
FIRST_RELEASE = (1, 3, 0)


def release_tags():
    tags = subprocess.run(["git", "tag"], capture_output=True, text=True, check=True).stdout.split()
    found = []
    for tag in tags:
        match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)-release", tag)
        if match and tuple(map(int, match.groups())) >= FIRST_RELEASE:
            found.append((tuple(map(int, match.groups())), tag))
    return [tag for _, tag in sorted(found)]


def read(ref, path):
    shown = subprocess.run(["git", "show", f"{ref}:{path}"], capture_output=True, text=True)
    return json.loads(shown.stdout) if shown.returncode == 0 else []


def read_working_tree(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def entries(notification_sources, notification_filters, observability):
    """Everything a catalog says, keyed so two releases can be compared."""
    found = {}
    for definition in notification_filters:
        found[("Notification", "filter", definition["name"])] = definition
    for source in notification_sources:
        for name in source.get("supportedFilters", []):
            found[("Notification", "support", source["name"], "filter", name)] = True
        found[("Notification", "source", source["name"])] = True
    for source in observability:
        found[("Observability", "source", source["name"])] = True
        for kind, key in (("filter", "supportedFilters"), ("trigger", "supportedActions")):
            for definition in source.get(key, []):
                found[("Observability", kind, definition["name"])] = definition
                found[("Observability", "support", source["name"], kind, definition["name"])] = True
    return found


def current_catalog():
    """Everything AlertCatalog.json holds, offered or removed."""
    catalog = read_working_tree(CATALOG)
    found = {}
    for definition in catalog["filters"]:
        found[("filter", definition["name"])] = True
    for definition in catalog["triggers"] + catalog.get("removedTriggers", []):
        found[("trigger", definition["name"])] = True
    for alert_type, key in (("Notification", "notificationSources"), ("Observability", "observabilitySources")):
        for source in catalog[key]:
            found[(alert_type, "source", source["name"])] = True
            for kind, keys in (("filter", ("filters", "removedFilters")), ("trigger", ("triggers", "removedTriggers"))):
                for name in [n for k in keys for n in source.get(k, [])]:
                    found[(alert_type, "support", source["name"], kind, name)] = True
    return found


def is_held(key, current):
    # Definitions are written once for both alert types in the one-format catalog.
    if len(key) == 3 and key[1] in ("filter", "trigger"):
        return (key[1], key[2]) in current
    return key in current


def shipped_by_release():
    shipped = {}
    for tag in release_tags():
        released = entries(
            read(tag, NOTIFICATION_SOURCES), read(tag, NOTIFICATION_FILTERS), read(tag, OBSERVABILITY)
        )
        for key, value in released.items():
            first_seen, _, _ = shipped.get(key, (tag, tag, value))
            shipped[key] = (first_seen, tag, value)
    return shipped


def main():
    current = current_catalog()
    shipped = shipped_by_release()
    if "--shipped" in sys.argv:
        report = [
            {"alertType": key[0], "source": key[2], "kind": key[3], "name": key[4]}
            for key in sorted(shipped, key=lambda k: [str(p) for p in k])
            if len(key) == 5
        ]
    else:
        report = [
            {"entry": list(key), "firstRelease": first, "lastRelease": last}
            for key, (first, last, _) in sorted(shipped.items(), key=lambda item: [str(p) for p in item[0]])
            if not is_held(key, current)
        ]
    json.dump(report, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
