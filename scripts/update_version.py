import sys
import argparse
import fileinput
import os
import re
import logging

# Configure the logger
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger()

# Function to update the Github workflow with search pattern as "input=" or "DOCKER_RELEASE_TAG="
def update_github_action(file_path, release_version):
    logger.info(
        f"Updating Github workflow's Docker version in {file_path} to version {release_version}\n"
    )
    try:
        with open(file_path, "r") as file:
            content = file.read()

        # Update the input pattern
        input_pattern = r"input=\d+(\.\d+)*(\.\d+)?"
        input_replacement = f"input={release_version}"
        updated_content = re.sub(input_pattern, input_replacement, content)

        # Update the DOCKER_RELEASE_TAG pattern
        docker_release_tag_pattern = r"DOCKER_RELEASE_TAG=\d+(\.\d+)*(\.\d+)?"
        docker_release_tag_replacement = f"DOCKER_RELEASE_TAG={release_version}"
        updated_content = re.sub(
            docker_release_tag_pattern, docker_release_tag_replacement, updated_content
        )

        with open(file_path, "w") as file:
            file.write(updated_content)

        logger.info(f"Patterns updated to {release_version} in {file_path}")
    except Exception as e:
        logger.error(f"An error occurred: {e}")


# Function to update the Python files in ingestion with search pattern as "version="
def update_python_files(file_path, release_version):
    # Logic for updating Python files
    logger.info(f"Updating version numbers in {file_path} to {release_version}\n")
    try:
        with open(file_path, "r") as file:
            content = file.read()

        pattern = r'version\s*=\s*"([^"]+)"'
        updated_content = re.sub(pattern, f'version="{release_version}"', content)

        with open(file_path, "w") as file:
            file.write(updated_content)

        logger.info(f"Version numbers updated to {release_version} in {file_path}")
    except Exception as e:
        logger.error(f"An error occurred: {e}")


# Function to update the image version in Docker compose files with search pattern where image, docker, getcollate, and openmetadata are used.
def update_dockerfile_version(file_path, release_version):
    # Logic for updating Docker compose version
    try:
        with open(file_path, "r") as file:
            content = file.read()

        # Update image versions using regular expression
        updated_content = re.sub(
            r"(image: docker\.getcollate\.io/openmetadata/.*?):[\d.]+",
            rf"\1:{release_version}",
            content,
        )

        with open(file_path, "w") as file:
            file.write(updated_content)

        logger.info(f"Updated image versions in {file_path}")
    except Exception as e:
        logger.error(f"An error occurred while updating {file_path}: {e}")


# Function to update the DOCKERFILE used to create the images, search pattern used as "RI_VERSION"
def update_ingestion_version(file_path, release_version):
    logger.info(
        f"Updating ingestion version in {file_path} to version {release_version}\n"
    )
    try:
        with open(file_path, "r") as file:
            content = file.read()

        pattern = r'RI_VERSION="[\d\.]+"'
        replacement = f'RI_VERSION="{release_version}"'
        updated_content = re.sub(pattern, replacement, content)

        with open(file_path, "w") as file:
            file.write(updated_content)

        logger.info(f"RI_VERSION updated to {release_version} in {file_path}")
    except Exception as e:
        logger.error(f"An error occurred: {e}")


def main():
    parser = argparse.ArgumentParser(description="Update version information in files.")
    parser.add_argument(
        "action_type", type=int, choices=range(1, 5), help="Type of action to perform"
    )
    parser.add_argument("file_path", type=str, help="Path to the file to update")
    parser.add_argument(
        "-s", dest="release_version", required=True, help="Release version to set"
    )

    args = parser.parse_args()

    action_type = args.action_type
    file_path = args.file_path
    release_version = args.release_version

    if action_type == 1:
        update_github_action(file_path, release_version)
    elif action_type == 2:
        update_python_files(file_path, release_version)
    elif action_type == 3:
        update_dockerfile_version(file_path, release_version)
    elif action_type == 4:
        update_ingestion_version(file_path, release_version)
    else:
        logger.error("Invalid action type")
        sys.exit(1)


if __name__ == "__main__":
    main()
