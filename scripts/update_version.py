import argparse
import copy
import logging
import re
import subprocess
import sys
from pathlib import Path

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


def read_toml(text: str) -> dict:
    """Parse project or lock metadata."""
    try:
        import tomllib
    except ImportError:
        import tomli as tomllib
    return tomllib.loads(text)


def project_version(text: str, version: str) -> str:
    """Replace only the project version in a pyproject document."""
    before = read_toml(text)
    block = re.search(r"(?ms)^\[project\]\n.*?(?=^\[|\Z)", text)
    if block is None:
        raise ValueError("Missing [project] table")
    updated, count = re.subn(r'(?m)^(version\s*=\s*")[^"]+(".*)$', rf"\g<1>{version}\2", block[0])
    if count != 1:
        raise ValueError("Expected one project version")
    result = text[: block.start()] + updated + text[block.end() :]
    expected = copy.deepcopy(before)
    expected["project"]["version"] = version
    if read_toml(result) != expected:
        raise ValueError("Project stamping changed unrelated metadata")
    return result


def local_lock_versions(text: str, versions: dict[str, tuple[str, str]]) -> str:
    """Update local package versions while preserving the rest of a lock."""
    expected = read_toml(text)
    result = text
    for package in expected["package"]:
        name = package["name"]
        if name not in versions:
            continue
        old, new = versions[name]
        if not ({"editable", "directory"} & package["source"].keys()):
            raise ValueError(f"Expected a local package: {name}")
        if package["version"] != old:
            raise ValueError(f"Lock version does not match project: {name}")
        package["version"] = new
        pattern = r'(\[\[package\]\]\nname = "' + re.escape(name) + r'"\nversion = ")[^"]+("\n)'
        result, count = re.subn(pattern, lambda match, value=new: match[1] + value + match[2], result)
        if count != 1:
            raise ValueError(f"Expected one local lock record: {name}")
    if read_toml(result) != expected:
        raise ValueError("Lock stamping changed unrelated selections")
    return result


def regex_sub(file_path: str, pattern: str, substitution: str):
    path = Path(file_path)
    content = path.read_text(encoding="utf-8")
    updated_content = re.sub(pattern, substitution, content)
    path.write_text(updated_content, encoding="utf-8")


def update_dockerfile_arg(arg, file_path, value):
    """Updates a Dockerfile ARG."""

    logger.info("Updating ARG %s in %s to %s", arg, file_path, value)

    regex_sub(
        file_path,
        rf"(ARG\s+{arg}=).+",
        rf'\1"{value}"',
    )


def update_docker_tag(args):
    """Updates the Docker Tag on docker-compose files."""

    file_path = args.file_path
    tag = args.tag

    logger.info("Updating Docker Tag in %s to %s", file_path, tag)

    regex_sub(
        file_path,
        r"(image: docker\.getcollate\.io/openmetadata/.*?):.+",
        rf"\1:{tag}",
    )


def update_ri_version(args):
    """Updates a Dockerfile RI_VERSION ARG."""

    version = args.version
    with_python_version = args.with_python_version
    file_path = args.file_path

    if with_python_version:
        version = get_python_version(version)

    update_dockerfile_arg(arg="RI_VERSION", file_path=file_path, value=version)


def update_pyproject_version(args):
    """Updates pyproject version."""
    from packaging.version import Version

    path = Path(args.file_path)
    text = path.read_text(encoding="utf-8")
    metadata = read_toml(text)["project"]
    version = str(Version(get_python_version(args.version)))
    updated = project_version(text, version)
    lock = path.with_name("uv.lock")
    changes = {path: updated}
    uv = Path(sys.executable).with_name("uv")
    if lock.is_file():
        changes[lock] = local_lock_versions(
            lock.read_text(encoding="utf-8"), {metadata["name"]: (metadata["version"], version)}
        )
        subprocess.run([str(uv), "lock", "--check", "--project", str(path.parent)], check=True)
    logger.info("Updating %s version to %s", path, version)
    for target, content in changes.items():
        target.write_text(content, encoding="utf-8")
    if lock.is_file():
        subprocess.run([str(uv), "lock", "--check", "--project", str(path.parent)], check=True)


def update_openapi_version(args):
    """Updates OpenAPI version in OpenMetadataApplication.java."""

    version = args.version
    file_path = "openmetadata-service/src/main/java/org/openmetadata/service/OpenMetadataApplication.java"

    logger.info("Updating OpenAPI version in %s to %s", file_path, version)

    regex_sub(
        file_path,
        r'(@Info\s*\(\s*title\s*=\s*"OpenMetadata APIs",\s*version\s*=\s*")\d+\.\d+\.\d+(")',
        rf"\g<1>{version}\g<2>",
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

    # Update OpenAPI version in OpenMetadataApplication.java
    parser_uoav = subparsers.add_parser("update_openapi_version")
    parser_uoav.add_argument("--version", "-v", type=str, help="Version to update to")
    parser_uoav.set_defaults(func=update_openapi_version)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
