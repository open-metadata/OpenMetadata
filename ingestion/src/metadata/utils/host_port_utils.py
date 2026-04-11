"""
Utility helpers for validating and sanitising hostPort connection strings.

Issue #24348 — users sometimes enter a full URL such as
``http://localhost:3306`` in the hostPort field instead of
``localhost:3306``.  The helpers below detect that mistake early and
raise a clear, actionable ValueError so the user knows exactly what to
fix, rather than seeing the cryptic
``ValueError: invalid literal for int() with base 10``.
"""

from urllib.parse import urlparse

from metadata.utils.logger import utils_logger

logger = utils_logger()

# Schemes we recognise as "user entered a full URL by mistake"
_URL_SCHEMES = frozenset(
    {"http", "https", "jdbc", "mysql", "postgresql", "mongodb", "redis"}
)


def clean_host_port(host_port: str) -> str:
    """
    Validate and sanitise a hostPort string.

    Accepted formats:
        - ``hostname``              e.g. ``localhost``
        - ``hostname:port``         e.g. ``localhost:3306``

    If the value looks like a full URL (contains a scheme such as
    ``http://``, ``https://``, ``jdbc://`` etc.) this function:
        1. Logs a warning telling the user the expected format.
        2. Strips the scheme and returns ``hostname`` or ``hostname:port``.
        3. Raises ``ValueError`` if no valid hostname can be extracted.

    Parameters
    ----------
    host_port:
        The raw hostPort string from the connection configuration.

    Returns
    -------
    str
        A clean ``hostname`` or ``hostname:port`` string suitable for
        further splitting or direct use in a SQLAlchemy URL.

    Raises
    ------
    ValueError
        When a URL scheme is detected but no valid hostname can be
        extracted from the value.
    """
    if not host_port:
        return host_port

    # Detect whether a scheme prefix is present
    scheme = host_port.split("://")[0].lower() if "://" in host_port else None

    if scheme is None:
        # No scheme — already in the expected format, return as-is
        return host_port.rstrip("/")

    # Scheme detected — warn the user with an actionable message
    logger.warning(
        "hostPort '%s' contains a URL scheme ('%s://'). "
        "Expected format is 'hostname' or 'hostname[:port]' "
        "(e.g. 'localhost:3306'). "
        "Stripping the scheme prefix automatically.",
        host_port,
        scheme,
    )

    parsed = urlparse(host_port)
    hostname = parsed.hostname  # None when urlparse cannot extract a host

    if not hostname:
        raise ValueError(
            f"hostPort '{host_port}' contains a URL scheme but no valid "
            f"hostname could be extracted. "
            f"Please use the format 'hostname' or 'hostname:port' "
            f"(e.g. 'localhost:3306')."
        )

    port = parsed.port  # None when no port is present
    return f"{hostname}:{port}" if port else hostname


def get_host_from_host_port(host_port: str) -> str:
    """
    Extract only the hostname from a ``hostname[:port]`` string.

    Delegates to :func:`clean_host_port` first so that URL-prefixed
    inputs are handled before splitting.

    Parameters
    ----------
    host_port:
        Raw hostPort string (may optionally contain a URL scheme).

    Returns
    -------
    str
        The hostname portion only (no port).
    """
    cleaned = clean_host_port(host_port)
    return cleaned.split(":")[0]
