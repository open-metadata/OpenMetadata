from hashlib import md5


def tuple_to_hash(tuple_):
    return md5(str(tuple_).encode("utf-8")).hexdigest()


def kwargs_to_tuple(d):
    """Convert expectation configuration kwargs to a canonical tuple."""
    if isinstance(d, list):
        return tuple(kwargs_to_tuple(v) for v in sorted(d))
    elif isinstance(d, dict):
        return tuple(
            (k, kwargs_to_tuple(v))
            for k, v in sorted(d.items())
            if k not in ["result_format", "include_config", "catch_exceptions", "meta"]
        )
    return d
