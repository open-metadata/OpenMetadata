import time

import nox


@nox.session(name="unit", reuse_venv=True, venv_backend="uv|venv")
def unit(session):
    # Install package with test extras
    start = time.time()

    session.install(".[all-dev-env, test-unit]")
    duration = time.time() - start
    session.log(f"Virtual env set in {duration:.2f} seconds")
    session.run("pytest", "tests/unit")


# @nox.session(name="integration")
# def integration(session):
#     # Install package with integration extras
#     session.install(".[integration]")
#     session.run("pytest", "tests/integration")
#
#
# @nox.session(name="lint")
# def lint(session):
#     session.install(".[dev]")
#     session.run("black", "--check", ".")
#     session.run("isort", "--check-only", ".")
#     session.run("mypy", ".")
