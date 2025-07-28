---
title: How to Contribute Code | Open Source Contribution Guide
description: Understand contribution guidelines for participating in the platform's development and submitting changes.
slug: /developers/contribute
---

# How to Contribute

Welcome to [OpenMetadata](https://open-metadata.org/). Our goal is to build an Open standard for Metadata. We genuinely believe this mission can only be achieved through building a great community.

We ❤️ all contributions, big and small!

## GitHub issues
Look for issues under [GitHub/issues tab](https://github.com/open-metadata/OpenMetadata/issues). If you have a feature request or found a bug please file an issue. This will help us track and will help the community overall as well.

{% image src="/images/v1.8/developers/contribute/github-issues.png" alt="GitHub issues" caption=" " /%}

## Fork GitHub project
OpenMetadata GitHub repository can be accessed here [https://github.com/open-metadata/OpenMetadata](https://github.com/open-metadata/OpenMetadata).

{% image src="/images/v1.8/developers/contribute/fork-github-project.png" alt="Fork GitHub project" caption=" " /%}

Create a local clone of your fork

```shell
git clone https://github.com/<username>/OpenMetadata.git
```

Set a new remote repository that points to the OpenMetadata repository to pull changes from the open-source OpenMetadata codebase into your clone

```shell
cd OpenMetadata/
git remote add upstream https://github.com/open-metadata/OpenMetadata.git
git remote -v
```

## Create a branch in your fork

```shell
git checkout -b ISSUE-200
```

Make changes. Follow the [Build the code & run tests](/developers/contribute/build-code-and-run-tests) on how to set up IntelliJ, Maven.

## Push your changes to GitHub

```shell
git add .
git commit -m "ISSUE-200: Meaningful commit message"
git push origin HEAD:refs/heads/issue-200
```

## Open a PR

1. Go to https://github.com/open-metadata/OpenMetadata/pulls
2. It should show an option to open a pull request.
{% image src="/images/v1.8/developers/contribute/open-pr.png" alt="Open a pull request" caption=" " /%}
3. If not, click on "New Pull request"
{% image src="/images/v1.8/developers/contribute/new-pr.png" alt="New Pull request" caption=" " /%}
4. Select your fork repository and branch
{% image src="/images/v1.8/developers/contribute/select-fork-branch.png" alt="Select your fork repository and branch" caption=" " /%}
5. Click "Create pull request"

## We are here to help
Please reach out to us anytime you need any help. [Slack](https://slack.open-metadata.org/) would be the fastest way to get a response.