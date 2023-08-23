import sys
import argparse
import fileinput
import os
import re

def update_github_action(file_path, release_version):
    print(f"Updating Github workflow's Docker version in {file_path} to version {release_version}\n")
    try:
        with open(file_path, 'r') as file:
            content = file.read()

        # Update the input pattern
        input_pattern = r'input=\d+(\.\d+)*(\.\d+)?'
        input_replacement = f'input={release_version}'
        updated_content = re.sub(input_pattern, input_replacement, content)

        # Update the DOCKER_RELEASE_TAG pattern
        docker_release_tag_pattern = r'DOCKER_RELEASE_TAG=\d+(\.\d+)*(\.\d+)?'
        docker_release_tag_replacement = f'DOCKER_RELEASE_TAG={release_version}'
        updated_content = re.sub(docker_release_tag_pattern, docker_release_tag_replacement, updated_content)

        with open(file_path, 'w') as file:
            file.write(updated_content)

        print(f"Patterns updated to {release_version} in {file_path}")
    except Exception as e:
        print(f"An error occurred: {e}")

def update_python_files(file_path, release_version):
    # Logic for updating Python files
    print(f"Updating version numbers in {file_path} to {release_version}\n")
    try:
        with open(file_path, 'r') as file:
            content = file.read()

        pattern = r'version\s*=\s*"([^"]+)"'
        updated_content = re.sub(pattern, f'version="{release_version}"', content)

        with open(file_path, 'w') as file:
            file.write(updated_content)

        print(f"Version numbers updated to {release_version} in {file_path}")
    except Exception as e:
        print(f"An error occurred: {e}")


def update_dockerfile_version(file_path, release_version):
    # Logic for updating Docker compose version
    try:
        with open(file_path, 'r') as file:
            content = file.read()

        # Update image versions using regular expression
        updated_content = re.sub(
            r'(image: docker\.getcollate\.io/openmetadata/.*?):[\d.]+',
            rf'\1:{release_version}',
            content
        )

        with open(file_path, 'w') as file:
            file.write(updated_content)

        print(f"Updated image versions in {file_path}")
    except Exception as e:
        print(f"An error occurred while updating {file_path}: {e}")

def update_ingestion_version(file_path, release_version):
    # Logic for updating ingestion version
    print(f"Updating ingestion version in {file_path} to version {release_version}\n")
    try:
        with open(file_path, 'r') as file:
            content = file.read()

        pattern = r'RI_VERSION="[\d\.]+"'
        replacement = f'RI_VERSION="{release_version}"'
        updated_content = re.sub(pattern, replacement, content)

        with open(file_path, 'w') as file:
            file.write(updated_content)

        print(f"RI_VERSION updated to {release_version} in {file_path}")
    except Exception as e:
        print(f"An error occurred: {e}")

def update_image_version(file_path, release_version):
    # Logic for updating image versions
    print(f"Updating image versions in {file_path} to version {release_version}\n")
    try:
        with open(file_path, 'r') as file:
            content = file.read()

        pattern = r'docker\.getcollate\.io/openmetadata/[\w\-]+:[\d\.]+'
        replacement = f'docker.getcollate.io/openmetadata/{release_version}'
        updated_content = re.sub(pattern, replacement, content)

        with open(file_path, 'w') as file:
            file.write(updated_content)

        print(f"Image versions updated to {release_version} in {file_path}")
    except Exception as e:
        print(f"An error occurred: {e}")

def main():
    if len(sys.argv) != 5:
        print("Usage: python3 update_version.py <action_type> <file_path> -s <release_version>")
        sys.exit(1)

    action_type = int(sys.argv[1])
    file_path = sys.argv[2]
    release_version = sys.argv[4]

    if action_type == 1:
        update_github_action(file_path, release_version)
    elif action_type == 2:
        update_python_files(file_path, release_version)
    elif action_type == 3:
        update_dockerfile_version(file_path, release_version)
    elif action_type == 4:
        update_ingestion_version(file_path, release_version)
    elif action_type == 5:
        update_ingestion_version(file_path, release_version)
    else:
        print("Invalid action type")
        sys.exit(1)

if __name__ == "__main__":
    main()
