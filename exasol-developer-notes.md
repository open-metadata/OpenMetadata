Hi @ all,

I in the process of creating a connector for Exasol DB (ingestion). Details can be seen in [this draft PR](https://github.com/open-metadata/OpenMetadata/pull/17166) (Note: please ignore the irrelevant files like `flake.nix`, I will remove them once I change the PR from draft to a regular PR.)

Setting up the connection in the UI "already works", except that the actual connection does not work (see screenshots).

That's where some of my questions come in. Basically, I am searching for a way to debug and verify (test) that the connection setup works well inmmost scenarios:

* No TLS
* TLS without server cert validation
* TLS
* ...

While the majority of the ingestion test suite seems mostly irrelevant for me because a lot of things are implemented by the base level abstractions the connectors use, I was wondering what the most lightweight and straightforward way for debugging and testing this would be?

Below you'll find things I have already figured out, but I am still unsure if I missed something. The workspace is quite complex, and I am just starting to dig into it.

* `ingestion/build/lib/metadata/utils/logger.py` provides functions to retrieve a logger
    - Likely `ingestion_logger()` is the one to use within the code added for the new connector
    - Where exactly will I find the logs when the connector is run in the OpenMetadata context?

* Debugging
    - Attach to debugger to CLI entry point? `/build/lib/metadata/cli/app:run_app()`
    - What would be a good and easy standard workflow file for testing?
    - It looks like this requires some of the ingestion to work.
        - Not suitable for connection-only tests?

* Testing
    - Regarding testing and connection, I found these files which are partially relevant but not exactly what I was looking for:
        - `ingestion/tests/unit/connections/test_test_connections.py`
        - `ingestion/tests/unit/connection_builders.py` (MySQL only?)
        - `ingestion/tests/unit/test_source_connection.py`
        - `ingestion/tests/unit/test_source.py`
    - Are there other tests relevant when it comes to connection?
    - How and where should I setup my connection test? 
        - Unit test(s): Parameters passed along correctly
        - Integration test(s): Connection is/can be established successfully
        - Is there a specific place for adding tests for connectors?


Note:

Full disclosure: Implementing this connector is my first touchpoint with OpenMetadata.

So far, I have been orienting myself mostly on the [Doris datasource PR](https://github.com/open-metadata/OpenMetadata/pull/14087/files). Still, I am unsure if this one is representative, also because it does not seem to add any tests. If you know a PR which would be more suitable to orient on, please let me know.


No worries I am not stuck but, I just was hoping to accelerate my progress a bit ;)

Best,
Nico

Problems encountered


Antler in the classpath causes issues with the open metadata server, setup with inelij

run java only
