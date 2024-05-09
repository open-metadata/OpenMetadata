import sys
import argparse
import re
import logging
import yaml

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger()


def update_github_action(args):
    """Updates the get-release-docker-tag action with the 'tag' value."""

    tag = args.tag

    file_path = ".github/actions/get-release-docker-tag/action.yml"

    logger.info(f"Updating Github Action {file_path} to version {tag}\n")

    with open(file_path, "r") as f:
        content = yaml.safe_load(f.read())

    # We want the structure to remain the same and fail if it changes.
    # We are centralizing the release version information on this action that is used by any relevant workflow.
    content["runs"]["steps"][0]["env"]["RELEASE_TAG"] = tag

    with open(file_path, "w") as f:
        yaml.dump(content, f, sort_keys=False)


def _update_with_regex(file_path, pattern, substitution):
    with open(file_path, "r") as f:
        content = f.read()

    updated_content = re.sub(
        pattern,
        substitution,
        content
    )

    with open(file_path, "w") as f:
        f.write(updated_content)


def update_docker_tag(args):
    """Updates the Docker Tag on docker-compose files."""

    file_path = args.file_path
    tag = args.tag

    logger.info(f"Updating Docker Tag in {file_path} to {tag}\n")

    _update_with_regex(
        file_path,
        r'(image: docker\.getcollate\.io/openmetadata/.*?):.+',
        rf'\1:{tag}',
    )


def update_dockerfile_arg(args):
    """Updates a Dockerfile ARG."""

    arg = args.arg
    file_path = args.file_path
    value = args.value

    logger.info(f"Updating ARG {arg} in {file_path} to {value}\n")

    _update_with_regex(
        file_path,
        rf"(ARG\s+{arg}=).+",
        rf"\1={value}",

    )


def update_pyproject_version(args):
    """Updates pyproject version."""

    file_path = args.file_path
    version = args.version

    logger.info(f"Updating {file_path} version to {version}\n")

    _update_with_regex(
        file_path,
        r'version\s*=\s*"[^"]+"',
        f'version = "{version}"',
    )


def main():
    parser = argparse.ArgumentParser(description="Update files for release.")
    subparsers = parser.add_subparsers(required=True)

    # Update Github Action parser
    parser_uga = subparsers.add_parser("update_github_action")
    parser_uga.add_argument("--tag", "-t", type=str, help="Tag to be returned by the Github Action.")
    parser_uga.set_defaults(func=update_github_action)

    # Update Docker tag
    parser_udt = subparsers.add_parser("update_docker_tag")
    parser_udt.add_argument("--file-path", "-f", type=str, help="Docker compose file to update.")
    parser_udt.add_argument("--tag", "-t", type=str, help="Tag to update the file to.")
    parser_udt.set_defaults(func=update_docker_tag)

    # Update Dockerfile ARG
    parser_uda = subparsers.add_parser("update_dockerfile_arg")
    parser_uda.add_argument("--arg", "-a", type=str, help="Argument to update.")
    parser_uda.add_argument("--file-path", "-f", type=str, help="Dockerfile file to update.")
    parser_uda.add_argument("--value", "-v", type=str, help="Value to set for the argument")
    parser_uda.set_defaults(func=update_dockerfile_arg)

    # Update pyproject.toml Version
    parser_upv = subparsers.add_parser("update_pyproject_version")
    parser_upv.add_argument("--file-path", "-f", type=str, help="pyproject.toml file to update.")
    parser_upv.add_argument("--version", "-v", type=str, help="Version to update to")
    parser_upv.set_defaults(func=update_pyproject_version)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
