import contextlib
import logging
import os
import tarfile

import docker
from docker.models.containers import Container


@contextlib.contextmanager
def try_bind(container, container_port, host_port):
    """Try to bind a port to the container, if it is already in use try another port."""
    try:
        with container.with_bind_ports(container_port, host_port) as container:
            yield container
    except docker.errors.APIError:
        logging.warning("Port %s is already in use, trying another port", host_port)
        with container.with_bind_ports(container_port, None) as container:
            yield container


def copy_dir_to_container(dir_path: str, container: Container, container_path: str):
    """Copy the contents of a directory to a path in a container. If the path
    does not exist it will be created.

    Args:
        dir_path (str): Path to the directory to copy.
        container (DockerContainer): The container to copy the directory to.
        container_path (str): The path to copy the directory to in the container.
    """
    tar_path = dir_path + ".tar"
    with tarfile.open(tar_path, "w") as tar:
        for item in os.listdir(dir_path):
            tar.add(os.path.join(dir_path, item), arcname=item)
    container.exec_run(["mkdir", "-p", container_path])
    with open(tar_path, "rb") as tar_file:
        container.put_archive(container_path, tar_file)
    os.remove(tar_path)
