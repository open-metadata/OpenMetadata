# Sample Configuration Files

This directory contains complete, working configuration files that accompany the OpenMetadata ingestion examples and test cases.

## Available Configurations

### Database Ingestion
- **`mysql_basic_config.json`** - Basic MySQL connector configuration for metadata ingestion
- **`mysql_profiler_config.json`** - Advanced MySQL configuration with data profiling enabled

### API Examples
- **`custom_properties_demo.sh`** - Executable script demonstrating custom metadata fields API usage

## Usage Instructions

### MySQL Ingestion Configuration

1. **Basic Ingestion**:
   ```bash
   # Copy and modify the configuration
   cp mysql_basic_config.json my_mysql_config.json
   
   # Update the following values:
   # - username and password
   # - hostPort
   # - jwtToken
   # - schemaFilterPattern includes/excludes
   
   # Run the ingestion
   metadata ingest -c my_mysql_config.json
   ```

2. **Profiler Configuration**:
   ```bash
   # Copy and modify the profiler configuration
   cp mysql_profiler_config.json my_profiler_config.json
   
   # Update the same values as basic config
   # Additionally adjust:
   # - profileSample (percentage or row count)
   # - samplingMethodType
   # - excludeColumns (for PII/sensitive data)
   
   # Run the profiler
   metadata profile -c my_profiler_config.json
   ```

### Custom Properties API Demo

1. **Prerequisites**:
   - OpenMetadata server running
   - `curl` and `jq` installed
   - Valid admin credentials

2. **Run the Demo**:
   ```bash
   # Make executable (if not already)
   chmod +x custom_properties_demo.sh
   
   # Update configuration variables at the top of the script:
   export OM_HOST="http://your-openmetadata-host:8585"
   export OM_USER="your-admin-email"
   export OM_PASS="your-admin-password"
   
   # Run the demo
   ./custom_properties_demo.sh
   ```

## Configuration Parameters Reference

### Common Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `hostPort` | OpenMetadata server API endpoint | `"http://localhost:8585/api"` |
| `jwtToken` | Authentication token from OM UI | `"eyJhbGciOiJIUzI1NiIs..."` |
| `serviceName` | Unique name for your connector | `"mysql_production"` |
| `schemaFilterPattern` | Database inclusion/exclusion patterns | See examples below |
| `tableFilterPattern` | Table inclusion/exclusion patterns | See examples below |

### Filter Pattern Examples

#### Include Specific Databases
```json
"schemaFilterPattern": {
  "includes": ["production", "analytics", "warehouse"]
}
```

#### Exclude System/Temporary Databases
```json
"schemaFilterPattern": {
  "excludes": ["information_schema", "performance_schema", "mysql", "sys", "test_.*", "temp_.*"]
}
```

#### Include Specific Tables
```json
"tableFilterPattern": {
  "includes": ["users", "orders", "products"],
  "excludes": [".*_temp", ".*_backup", ".*_archive"]
}
```

### Profiling-Specific Parameters

| Parameter | Description | Recommended Values |
|-----------|-------------|-------------------|
| `profileSample` | Sample size for profiling | 1-10% for large tables, 100% for small |
| `profileSampleType` | `"PERCENTAGE"` or `"ROWS"` | `"PERCENTAGE"` for consistency |
| `samplingMethodType` | `"SYSTEM"`, `"BERNOULLI"`, `"RANDOM"` | `"SYSTEM"` for best performance |
| `confidence` | Statistical confidence level | `95` (standard) |
| `timeoutSeconds` | Maximum profiling time | `43200` (12 hours) |

## Security Notes

⚠️ **Important Security Considerations**:

1. **JWT Tokens**: Replace placeholder tokens with real tokens from your OpenMetadata instance
2. **Passwords**: Never commit real passwords to version control
3. **PII Data**: Configure `excludeColumns` to exclude sensitive columns from profiling
4. **SSL**: Set `ssl_disabled: "false"` and configure proper SSL certificates for production

## Troubleshooting

### Common Issues

1. **Authentication Errors**:
   - Verify JWT token is current (tokens expire)
   - Check user permissions in OpenMetadata UI

2. **Connection Errors**:
   - Verify database host and port
   - Check database user permissions
   - Test network connectivity

3. **Performance Issues**:
   - Reduce sample size for profiling
   - Exclude large text/blob columns
   - Use more restrictive filter patterns

### Validation Commands

```bash
# Test configuration syntax
python -c "import json; print('Valid JSON') if json.load(open('your_config.json')) else print('Invalid JSON')"

# Test database connectivity
metadata ingest -c your_config.json --dry-run

# Test profiler configuration
metadata profile -c your_profiler_config.json --dry-run
```

## Support

For additional help:
1. Check the main tutorial documentation
2. Review OpenMetadata connector documentation
3. Check OpenMetadata community forums
4. Review logs for specific error messages

## File Maintenance

These configuration files are maintained alongside the ingestion examples documentation. When updating:

1. Test all configurations with a local OpenMetadata instance
2. Update parameter references in the main documentation
3. Ensure security best practices are followed
4. Validate JSON syntax before committing