import argparse
import re
import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger()


def get_python_version(version: str) -> str:
    "Get Python Package formatted version"

    if "-rc" in version:
        version_parts = version.split("-")
        return f"{version_parts[0]}.0{version_parts[1]}"
    if "-SNAPSHOT" in version:
        version_parts = version.split("-")
        return f"{version_parts[0]}.0.dev0"
    return f"{version}.0"


def regex_sub(file_path: str, pattern: str, substitution: str):
    with open(file_path, "r") as f:
        content = f.read()

    updated_content = re.sub(
        pattern,
        substitution,
        content
    )

    with open(file_path, "w") as f:
        f.write(updated_content)


def update_dockerfile_arg(arg, file_path, value):
    """Updates a Dockerfile ARG."""

    logger.info(f"Updating ARG {arg} in {file_path} to {value}\n")

    regex_sub(
        file_path,
        rf"(ARG\s+{arg}=).+",
        rf'\1"{value}"',

    )


def update_docker_tag(args):
    """Updates the Docker Tag on docker-compose files."""

    file_path = args.file_path
    tag = args.tag

    logger.info(f"Updating Docker Tag in {file_path} to {tag}\n")

    regex_sub(
        file_path,
        r'(image: docker\.getcollate\.io/openmetadata/.*?):.+',
        rf'\1:{tag}',
    )


def update_ri_version(args):
    """Updates a Dockerfile RI_VERSION ARG."""

    version = args.version
    with_python_version = args.with_python_version
    file_path = args.file_path

    if with_python_version:
        version = get_python_version(version)

    update_dockerfile_arg(
        arg="RI_VERSION",
        file_path=file_path,
        value=version
    )


def update_pyproject_version(args):
    """Updates pyproject version."""

    file_path = args.file_path
    version = args.version

    version = get_python_version(version)


    logger.info(f"Updating {file_path} version to {version}\n")

    regex_sub(
        file_path,
        r'version\s*=\s*"[^"]+"',
        f'version = "{version}"',
    )


def main():
    parser = argparse.ArgumentParser(description="Update files for release.")
    subparsers = parser.add_subparsers(required=True)

    # Update Docker tag
    parser_udt = subparsers.add_parser("update_docker_tag")
    parser_udt.add_argument("--file-path", "-f", type=str, help="Docker compose file to update.")
    parser_udt.add_argument("--tag", "-t", type=str, help="Tag to update the file to.")
    parser_udt.set_defaults(func=update_docker_tag)

    # Update Dockerfile ARG
    parser_urv = subparsers.add_parser("update_ri_version")
    parser_urv.add_argument("--file-path", "-f", type=str, help="Dockerfile file to update.")
    parser_urv.add_argument("--version", "-v", type=str, help="Verision to set for the argument")
    parser_urv.add_argument("--with-python-version", action="store_true")
    parser_urv.set_defaults(func=update_ri_version)

    # Update pyproject.toml Version
    parser_upv = subparsers.add_parser("update_pyproject_version")
    parser_upv.add_argument("--file-path", "-f", type=str, help="pyproject.toml file to update.")
    parser_upv.add_argument("--version", "-v", type=str, help="Version to update to")
    parser_upv.set_defaults(func=update_pyproject_version)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
