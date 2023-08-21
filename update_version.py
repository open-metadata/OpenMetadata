import sys
import argparse
import fileinput
import os
import re

# def update_ri_version(file_path, new_version):
#     try:
#         with open(file_path, 'r') as file:
#             content = file.read()

#         pattern = r'R_VERSION: ".*"'
#         replacement = f'R_VERSION: "{new_version}"'
#         updated_content = re.sub(pattern, replacement, content)

#         with open(file_path, 'w') as file:
#             file.write(updated_content)

#         print(f"R_VERSION updated to {new_version} in {file_path}")
#     except Exception as e:
#         print(f"An error occurred: {e}")

# def update_docker_files(file_path, new_version):
#     try:
#         with open(file_path, 'r') as file:
#             content = file.read()

#         pattern = r'ARG RI_VERSION=".*"'
#         replacement = f'ARG RI_VERSION="{new_version}"'
#         updated_content = re.sub(pattern, replacement, content)

#         with open(file_path, 'w') as file:
#             file.write(updated_content)

#         print(f"Version updated to {new_version} in {file_path}")
#     except Exception as e:
#         print(f"An error occurred: {e}")

# def update_python_files(file_path, new_version):
#     # Add logic to update Python files here
#     pass

# if __name__ == "__main__":
#     if len(sys.argv) != 5:
#         print("Usage: python update_version.py <file_type> <file_path> -s <new_version>")
#     else:
#         file_type = sys.argv[1]
#         file_path = sys.argv[2]
#         new_version = sys.argv[4]
        
#         if file_type == "dockerfile":
#             update_docker_files(file_path, new_version)
#         elif file_type == "yaml":
#             update_ri_version(file_path, new_version)
#         elif file_type == "python":
#             update_python_files(file_path, new_version)
#         else:
#             print("Invalid file type. Supported types: dockerfile, yaml, python")


# -----
# def update_version(file_path, from_version, to_version):
#     with fileinput.FileInput(file_path, inplace=True, backup=".bak") as file:
#         for line in file:
#             print(line.replace(from_version, to_version), end='')

# def main():
#     parser = argparse.ArgumentParser(description="Update version tags in files")
#     parser.add_argument("file_paths", nargs="+", help="List of file paths to update")
#     parser.add_argument("-s", "--source_version", required=True, help="Source version to replace")
#     parser.add_argument("-d", "--destination_version", required=True, help="Destination version to set")

#     args = parser.parse_args()

#     for file_path in args.file_paths:
#         if not os.path.exists(file_path):
#             print(f"File {file_path} does not exist. Skipping...")
#             continue

#         update_version(file_path, args.source_version, args.destination_version)
#         print(f"Updated version in {file_path}")

# if __name__ == "__main__":
#     main()


def update_github_action(file_path, release_version):
    # Logic for updating GitHub action
    print(f"Updating GitHub action in {file_path} to version {release_version} \n")

def update_python_files(file_path, release_version):
    # Logic for updating Python files
    print(f"Updating Python files in {file_path} to version {release_version} \n")

def update_dockerfile_version(file_path, release_version):
    # Logic for updating Dockerfile version
    print(f"Updating Dockerfile version in {file_path} to version {release_version} \n")

def update_ingestion_version(file_path, release_version):
    # Logic for updating ingestion version
    print(f"Updating ingestion version in {file_path} to version {release_version} \n")

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
    else:
        print("Invalid action type")
        sys.exit(1)

if __name__ == "__main__":
    main()
