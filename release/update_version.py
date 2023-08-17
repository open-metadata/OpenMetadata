import sys
import argparse
import fileinput
import os

def update_version(file_path, from_version, to_version):
    with fileinput.FileInput(file_path, inplace=True, backup=".bak") as file:
        for line in file:
            print(line.replace(from_version, to_version), end='')

def main():
    parser = argparse.ArgumentParser(description="Update version tags in files")
    parser.add_argument("file_paths", nargs="+", help="List of file paths to update")
    parser.add_argument("-s", "--source_version", required=True, help="Source version to replace")
    parser.add_argument("-d", "--destination_version", required=True, help="Destination version to set")

    args = parser.parse_args()

    for file_path in args.file_paths:
        if not os.path.exists(file_path):
            print(f"File {file_path} does not exist. Skipping...")
            continue

        update_version(file_path, args.source_version, args.destination_version)
        print(f"Updated version in {file_path}")

if __name__ == "__main__":
    main()
