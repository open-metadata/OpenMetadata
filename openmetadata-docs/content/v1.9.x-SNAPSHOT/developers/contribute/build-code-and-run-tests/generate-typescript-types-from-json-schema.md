---
title: Generate Typescript Types From JSON Schema
description: Use this guide to generate TypeScript type definitions from JSON Schema to maintain consistency and type safety.
slug: /developers/contribute/build-code-and-run-tests/generate-typescript-types-from-json-schema
---

# Generate Typescript Types From JSON Schema
This step-by-step guide will help you to generate typescript types from JSON schema.

We are using [quicktype](https://quicktype.io/) to generate types from JSON Schema.

## Prerequisites

Ensure you have `quicktype` installed. If not, install it using the commands below.

## Steps to Generate TypeScript Types

### Step 1: Install Dependencies

Navigate to the `openmetadata-ui` directory and install dependencies:

```bash
cd openmetadata-ui/src/main/resources/ui
yarn install
```

### Step 2: Option A - Generate Types for Staged Files

Return to the root folder, add the relevant files to the staging area, and execute the following command:

```bash
changed_files=$(git diff --cached --name-only --diff-filter=ACM | grep 'openmetadata-spec/src/main/resources/json/schema/')
```

This command identifies all staged files located in the `openmetadata-spec/src/main/resources/json/schema/` path and stores the file paths in the changed_files variable.

### Step 2: Option B - Generate Types for Specific JSON File

From the OpenMetadata root folder, you can generate types for a specific JSON schema file using:

```bash
./generate_ts.sh <relative path of json file>
```

Examples:
```bash
./generate_ts.sh openmetadata-spec/src/main/resources/json/schema/entity/services/ingestionPipelines/ingestionPipeline.json
```

Note: The path should be relative to the OpenMetadata directory.

### Step 3: Generate TypeScript Types

If using Option A, run the following script to generate TypeScript types for the identified JSON schema files:

```bash
./openmetadata-ui/src/main/resources/ui/json2ts.sh $changed_files
```

This script processes the staged JSON schema files and generates the corresponding TypeScript types.

The generated TypeScript types will be available in the appropriate location within the UI project structure.
