# How to Contribute

Welcome to [OpenMetadata](https://open-metadata.org). Our goal is to build an Open standard for Metadata. We genuinely believe this mission can only be achieved through building a great community.

We ❤️ all contributions, big and small!

## Github issues

Look for issues under [github/issues tab](https://github.com/open-metadata/OpenMetadata/issues) . If you have a feature request or found a bug please file an issue. This will help us track and will help community overall as well.

![./images/new-issue.png](../../../.gitbook/assets/new-issue.png)

## Fork Github project

OpenMetadata Github repository can be accessed here [https://github.com/open-metadata/OpenMetadata](https://github.com/open-metadata/OpenMetadata) .

![./images/fork-github.png](<../../../.gitbook/assets/fork-github (1).png>)

Create a local clone of your fork

```bash
git clone https://github.com/<username>/OpenMetadata.git
```

Set a new remote repository that points to the OpenMetadata repository to pull changes from the open source OpenMetadata codebase into your clone

```bash
cd OpenMetadata/
git remote add upstream https://github.com/open-metadata/OpenMetadata.git
git remote -v
```

## Create a branch in your fork

```bash
git checkout -b ISSUE-200
```

Make changes. Follow the [Coding Style](coding-style.md) Guide on best practices and [Build the code & run tests](build-code-run-tests.md) on how to setup Intellij, Maven

## Push your changes to Github

```bash
git add .
git commit -m "ISSUE-200: Meaningful commit message"
git push origin HEAD:refs/heads/issue-200
```

## Open a PR

1. Go to [https://github.com/open-metadata/OpenMetadata/pulls](https://github.com/open-metadata/OpenMetadata/pulls)
2. It should show an option to open a pull request. ![./images/pull-request-1.png](../../../.gitbook/assets/pull-request-1.png)
3.  If not, click on "New Pull request"

    ![./images/pull-request.png](../../../.gitbook/assets/pull-request.png)
4. Select your fork repository and branch ![./images/pull-request-2.png](../../../.gitbook/assets/pull-request-2.png)
5. Click "Create pull request"

## Quality tools

When working on the Ingestion Framework, you might want to take into consideration the following style-check tooling:
- [pylint](www.pylint.org) is a Static Code Analysis tool to catch errors, align coding standards and help us follow conventions and apply improvements.
- [black](https://black.readthedocs.io/en/stable/) can be used to both autoformat the code and validate that the codebase is compliant.
- [isort](https://pycqa.github.io/isort/) helps us not lose time trying to find the proper combination of importing from `stdlib`, requirements, project files…

The main goal is to ensure standardised formatting throughout the codebase.

When developing, you can run this tools with `make` recipes: `make lint`, `make black` and `make isort`. Note that we are excluding the generated sources
from the JSON Schema standards.

If you want to take this one step further and make sure that you are not commiting any malformed changes, you can use [pre-commit hooks](https://pre-commit.com/).
This is a powerful tool that allows us to run specific validations at commit-time. If those validations fail, the commit won't proceed. The interesting point
is that the tools are going to fix your code for you, so you can freely try to commit again!

You can install our hooks via `make precommit_install`.

### Tooling Status

We are currently using:
- `pylint` & `black` in the CI validations, so make sure to review your PRs for any warnings you generated.
- `black` & `isort` in the pre-commit hooks.

## We are here to help

Please reach out to us anytime you need any help. [Slack](https://slack.open-metadata.org) would be fastest way to get a response.
