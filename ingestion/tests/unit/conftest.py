def pytest_pycollect_makeitem(collector, name, obj):
    try:
        if obj.__name__ in ("TestSuiteSource", "TestSuiteInterfaceFactory"):
            return []
        if obj.__base__.__name__ in ("BaseModel", "Enum"):
            return []
    except AttributeError:
        pass
