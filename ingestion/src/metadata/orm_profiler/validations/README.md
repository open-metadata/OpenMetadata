# Validations

Based on the Profile results, compare them against a set of rules to mark the validation as OK/KO.

In the Validations' module there are a couple of things going on:
- We define the `grammar` used to parse test definitions, e.g., "row_count > 100"
- We define the structure and process in which we can take a full expression
    and run it against profiler results to flag a Valid / Invalid response.
