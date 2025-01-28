---
title: Production-Ready Requirements for OpenMetadata Deployment
slug: /deployment/requirements
collate: false
---

# Production-Ready Requirements for OpenMetadata Deployment

This section outlines the minimum hardware and resource specifications required for deploying OpenMetadata and its dependencies. These recommendations ensure optimal performance and scalability for your deployment.

## OpenMetadata Server  
- **vCPUs**: Minimum of 2 vCPUs  
- **Memory**: 8 GiB  
- **Storage Volume**: 20 GiB (if using persistent volumes for logs)  

## External Services  
OpenMetadata depends on the following external services, each with specific resource requirements:

### Database (e.g., PostgreSQL)  
- **vCPUs**: Minimum of 2 vCPUs per instance  
- **Memory**: 8 GiB RAM per instance  
- **Storage Volume**:  
  - 30 GiB (minimum)  
  - Dynamic expansion up to 100 GiB  

### Elasticsearch  
- **vCPUs**: Minimum of 2 vCPUs per instance  
- **Memory**: 8 GiB RAM per instance  
- **Storage Volume**: 64 GiB  

These specifications are also applicable for managed services like **AWS RDS**, **GCP CloudSQL**, or **AWS OpenSearch**.  

## Summary Recommendations  
For a typical OpenMetadata deployment (one replica):  
- **OpenMetadata Server**: 2 vCPUs, 8 GiB RAM, 20 GiB persistent storage  
- **Database**: 2 vCPUs, 8 GiB RAM, 30 GiB storage (expandable to 100 GiB)  
- **Elasticsearch**: 2 vCPUs, 8 GiB RAM, 64 GiB storage

{%note%}
Ensure these resources are allocated adequately to prevent performance bottlenecks or scalability issues. Managed services with equivalent specifications are supported.
{%/note%}
