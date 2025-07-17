def pytest_pycollect_makeitem(collector, name, obj):
    try:
        if obj.__name__ in ("TestSuiteSource", "TestSuiteInterfaceFactory"):
            return []
        if obj.__base__.__name__ in ("BaseModel", "Enum"):
            return []
    except AttributeError:
        pass


def pytest_collection_modifyitems(session, config, items):
    """Reorder test items to ensure certain files run last."""
    # List of test files that should run last
    last_files = [
        "test_dependency_injector.py",
        # Add other files that should run last here
    ]

    # Get all test items that should run last
    last_items = []
    other_items = []

    for item in items:
        if any(file in item.nodeid for file in last_files):
            last_items.append(item)
        else:
            other_items.append(item)

    # Reorder the items
    items[:] = other_items + last_items
