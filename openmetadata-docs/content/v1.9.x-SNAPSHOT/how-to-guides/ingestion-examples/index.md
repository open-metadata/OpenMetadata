---
title: Ingestion Examples & Test Cases
description: Practical step-by-step examples for configuring and testing OpenMetadata ingestion workflows with detailed troubleshooting guides.
slug: /how-to-guides/ingestion-examples
---

# Ingestion Examples & Test Cases

This section provides practical, real-world examples for configuring and testing OpenMetadata ingestion workflows. Each test case includes complete configuration files, step-by-step instructions, common error scenarios, and validation steps.

These examples complement the existing connector documentation by providing detailed walkthrough tutorials that help users successfully implement and troubleshoot their ingestion pipelines.

## Available Test Cases

{% tilesContainer %}
{% tile
    title="MySQL Ingestion Pipeline"
    description="Complete guide for configuring MySQL connector with sample configurations, error handling, and validation steps."
    link="/how-to-guides/ingestion-examples/mysql-ingestion-pipeline"
    icon="database"
/%}
{% tile
    title="Custom Metadata Fields via API"
    description="Step-by-step API tutorial for creating custom metadata fields with authentication and entity attachment examples."
    link="/how-to-guides/ingestion-examples/custom-metadata-fields-api"
    icon="api"
/%}
{% tile
    title="Data Profiling Configuration"
    description="Comprehensive guide for setting up data profiling with performance optimization and result visualization."
    link="/how-to-guides/ingestion-examples/data-profiling-configuration"
    icon="profiler"
/%}
{% /tilesContainer %}

## What You'll Learn

- **Complete Configuration Examples**: Full working configurations with all parameters explained
- **Common Error Scenarios**: Troubleshooting guides for typical issues and their solutions
- **Validation Steps**: How to verify successful ingestion and identify problems early
- **Best Practices**: Performance optimization and security considerations
- **Real-world Use Cases**: Practical examples that mirror production scenarios

## Prerequisites

Before following these examples, ensure you have:

- OpenMetadata instance running and accessible
- Python environment with required dependencies installed
- Access to your data sources with appropriate permissions
- Basic familiarity with OpenMetadata concepts

{% note %}
These examples are designed to be followed step-by-step and provide immediately actionable solutions. Each test case includes complete, working configuration files that you can adapt for your environment.
{% /note %}