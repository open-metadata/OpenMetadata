# Custom PyLint plugins

- `pint_checker`: to handle `print` statements as warnings.
  - Add it to `.pylintrc` as `load-plugins=ingestion.plugins.print_checker` under `[MASTER]`.

You'll need to update the path of `pylint` at runtime with `PYTHONPATH="${PYTHONPATH}:./ingestion/plugins"`.
