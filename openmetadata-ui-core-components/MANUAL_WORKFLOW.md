# Manual Workflow Trigger Guide

## Quick Reference: Running Tests On-Demand

You can trigger the UI Core Components tests manually from the GitHub Actions interface.

### Steps

1. **Navigate to Actions**
   - Go to your GitHub repository
   - Click the **Actions** tab

2. **Select Workflow**
   - Find and click **"UI Core Components Tests"** in the left sidebar

3. **Trigger Workflow**
   - Click the **"Run workflow"** button (top right)
   - A dropdown will appear with options

4. **Configure Options**

   | Option | Description | Default | When to Use |
   |--------|-------------|---------|-------------|
   | **Branch** | Branch to test | `main` | Test feature branches before merging |
   | **Generate coverage report** | Create coverage files | `true` | Skip for faster runs during debugging |
   | **Skip TypeScript type check** | Skip type checking | `false` | Skip when focusing only on test logic |

5. **Run**
   - Click the green **"Run workflow"** button
   - Workflow will start immediately

### Use Cases

#### 🔍 **Test a Feature Branch**
```
Branch: feature/my-new-component
Generate coverage: ✓
Skip type check: ✗
```
Use when: Testing a feature before creating a PR

#### ⚡ **Quick Test Run**
```
Branch: main
Generate coverage: ✗
Skip type check: ✓
```
Use when: Quick sanity check without full coverage analysis

#### 📊 **Full Coverage Analysis**
```
Branch: main
Generate coverage: ✓
Skip type check: ✗
```
Use when: Want complete test results with coverage metrics

#### 🐛 **Debug Test Failures**
```
Branch: bugfix/failing-test
Generate coverage: ✗
Skip type check: ✓
```
Use when: Debugging specific test failures

### Examples

**Example 1: Test a release branch**
```
Branch: release-1.5.0
Generate coverage: ✓
Skip type check: ✗
```

**Example 2: Quick validation**
```
Branch: dev
Generate coverage: ✗
Skip type check: ✓
```

**Example 3: Pre-merge validation**
```
Branch: feature/data-grid-enhancement
Generate coverage: ✓
Skip type check: ✗
```

### Viewing Results

1. After triggering, you'll see the workflow run appear at the top of the workflow page
2. Click on the run to see real-time progress
3. View individual job logs by clicking on each job
4. Check artifacts for test results and coverage reports

### Tips

- ✅ Use manual runs to test branches before creating PRs
- ✅ Skip coverage for faster feedback during development
- ✅ Run with full options before important releases
- ❌ Don't run unnecessarily - automatic triggers handle most cases
- 💡 Bookmark the Actions page for quick access

### Troubleshooting

**Workflow button not visible?**
- Check you have write access to the repository
- Ensure you're viewing the correct repository

**Branch not in dropdown?**
- Type the branch name manually
- Ensure the branch exists remotely (push your local branch first)

**Run fails immediately?**
- Check workflow syntax in `.github/workflows/ui-core-components-tests.yml`
- Verify the branch exists
- Check GitHub Actions logs for error details

### Monitoring

View all workflow runs:
```
Repository → Actions → UI Core Components Tests
```

Filter by:
- Branch
- Event (manual vs PR vs push)
- Status (success, failure, in progress)

### Advanced: GitHub CLI

You can also trigger workflows using the GitHub CLI:

```bash
# Trigger on main branch with all options
gh workflow run "UI Core Components Tests" \
  --ref main \
  -f branch=main \
  -f run-coverage=true \
  -f skip-type-check=false

# Quick run on feature branch
gh workflow run "UI Core Components Tests" \
  --ref feature/my-branch \
  -f branch=feature/my-branch \
  -f run-coverage=false \
  -f skip-type-check=true
```

### API Access

Using GitHub REST API:

```bash
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.github.com/repos/OWNER/REPO/actions/workflows/ui-core-components-tests.yml/dispatches \
  -d '{
    "ref": "main",
    "inputs": {
      "branch": "main",
      "run-coverage": "true",
      "skip-type-check": "false"
    }
  }'
```

---

**Related Documentation:**
- [CI.md](src/main/resources/ui/CI.md) - Full CI/CD documentation
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
