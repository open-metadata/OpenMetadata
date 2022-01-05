---
description: >-
  This guide will help you upgrade an existing Docker deployment of OpenMetadata
  to a later version.
---

# Upgrade OpenMetadata

## Procedure

### 1. Ensure your Python virtual environment is activated

The procedure for [installing OpenMetadata](run-openmetadata.md) asks you to create a new directory and Python virtual environment. The procedure then asks you to install the `openmetadata-ingestion[docker]` Python module in this virtual environment.

In your command-line environment, please navigate to the directory where you installed `openmetadata-ingestion[docker]` and activate the virtual environment by running the following command.

```
source env/bin/activate
```

### 2. Check the current version you have installed

To check the version of `openmetadata-ingestion[docker]` that you have installed, run the following command.

```bash
metadata --version
```

Upon running this command you should see output similar to the following.

```bash
metadata, version metadata 0.5.0 from /Users/om/openmetadata-docker/env/lib/python3.8 (python 3.8)
```

### 3. Check available versions

To confirm that there is a later version of `openmetadata-ingestion[docker]` available and identify the version you want to install, please run the following command.

```
pip3 install 'openmetadata-ingestion[docker]'==
```

Upon running this command, you should see output similar to the following.

```
ERROR: Could not find a version that satisfies the requirement 
openmetadata-ingestion[docker]== (from versions: 0.2.0, 0.2.1, 0.2.2, 0.2.3, 0.2.4,
0.3.0, 0.3.2, 0.4.0.dev0, 0.4.0.dev6, 0.4.0, 0.4.1.dev6, 0.4.1, 0.4.2.dev1, 0.4.2, 
0.4.2.1, 0.4.3.dev1, 0.4.3.dev2, 0.4.3.dev3, 0.4.3.dev4, 0.4.3, 0.4.4, 0.4.5, 0.4.7,
0.4.8.dev0, 0.4.8.dev2, 0.4.8, 0.4.9, 0.4.10, 0.4.11, 0.5.0rc0, 0.5.0rc1, 0.5.0, 
0.5.1.dev0, 0.6.0.dev0, 0.7.0.dev1, 0.7.0.dev2, 0.7.0.dev3, 0.7.0.dev4)
ERROR: No matching distribution found for openmetadata-ingestion[docker]==
```

The error messages are expected. This is the accepted means of checking available versions for a Python module using `pip`.

The output provides a complete list of available versions and enables you to determine whether there are release versions later than the version you currently have installed. Release versions have the form `x.x.x`. Examples of release versions in the above output include, `0.2.0`, `0.4.2`, and `0.5.0`.&#x20;

From this output you can also find patch releases (e.g., `0.4.2.1`), release candidates (`0.5.0rc1`), and development releases (e.g., `0.7.0.dev4`).&#x20;

### 4. Stop your currently running deployment

Before upgrading, if you are currently running an OpenMetadata deployment, please stop the deployment by running the following command.

```bash
metadata docker --stop
```

### 5. Install the version of your choice

#### Option 1. Install the latest release version

You may install the latest release version by running the following command.

```bash
pip3 install --upgrade 'openmetadata-ingestion[docker]'
```

#### Option 2. Install a specific release, patch, or development version

You may install a specific version of `openmetadata-ingestion[docker]`by running the following command, specifying the version you want to install in place of `<version>`.

```bash
pip3 install --upgrade 'openmetadata-ingestion[docker]'==<version>
```

For example, if you want to install the `0.7.0.dev4` release, you would run the following command.

```bash
pip3 install --upgrade 'openmetadata-ingestion[docker]'==0.7.0.dev4
```

### 6. Restart your deployment

Once you have successfully installed your preferred version of `openmetadata-ingestion[docker]`, restart your deployment using the new version, by running the following command.

```bash
metadata docker --start
```
