import contextlib
import logging

import docker


@contextlib.contextmanager
def try_bind(container, container_port, *host_ports):
    """Try to bind a container locally on a specfic port and yield the container. If the port is already in use,
    try another port. This is useful when running tests locally and we want to avoid having to reconfigure SQL clients
    to connect to a different port each time we run the tests. Multiple ports can be passed so that the next available
    port is tried if the previous one is already in use.
    """
    for host_port in host_ports:
        try:
            with container.with_bind_ports(container_port, host_port) as container:
                yield container
                return
        except docker.errors.APIError:
            logging.warning("Port %s is already in use, trying another port", host_port)
    with container.with_bind_ports(container_port, None) as container:
        yield container
