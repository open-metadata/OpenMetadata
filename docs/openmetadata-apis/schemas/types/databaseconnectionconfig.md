# Database Connection Config

Database Connection Config to capture connection details to a database service.

**$id:** [**https://open-metadata.org/schema/type/databaseConnectionConfig.json**](https://open-metadata.org/schema/type/databaseConnectionConfig.json)

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
 - **username**
	 - username to connect  to the data source.
	 - Type: `string`
 - **password**
	 - password to connect  to the data source.
	 - Type: `string`
 - **hostPort**
	 - Host and port of the data source.
	 - Type: `string`
 - **database**
	 - Database of the data source.
	 - Type: `string`
 - **schema**
	 - schema of the data source.
	 - Type: `string`
 - **includeViews**
	 - optional configuration to turn off fetching metadata for views.
	 - Type: `boolean`
	 - Default: _true_
 - **includeTables**
	 - Optional configuration to turn off fetching metadata for tables.
	 - Type: `boolean`
	 - Default: _true_
 - **generateSampleData**
	 - Turn on/off collecting sample data.
	 - Type: `boolean`
	 - Default: _true_
 - **sampleDataQuery**
	 - query to generate sample data.
	 - Type: `string`
	 - Default: _"select * from {}.{} limit 50"_
 - **enableDataProfiler**
	 - Run data profiler as part of ingestion to get table profile data.
	 - Type: `boolean`
	 - Default: _false_
 - **includeFilterPattern**
	 - Regex to only fetch tables or databases that matches the pattern.
	 - Type: `array`
		 - **Items**
		 - Type: `string`
 - **excludeFilterPattern**
	 - Regex exclude tables or databases that matches the pattern.
	 - Type: `array`
		 - **Items**
		 - Type: `string`


_This document was updated on: Monday, March 7, 2022_