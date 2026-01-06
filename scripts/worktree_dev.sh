#!/bin/bash
# ~/scripts/task.sh

set -e

ISSUE=$1

if [ -z "$ISSUE" ]; then
    echo "Usage: task <issue-number>"
    exit 1
fi

REPO_ROOT=$(git rev-parse --show-toplevel)
REPO_NAME=$(basename "$REPO_ROOT")
WORKTREE_PATH="${REPO_ROOT}/../${REPO_NAME}-${ISSUE}"
BRANCH_NAME="feature/${ISSUE}"
LOG_FILE="${WORKTREE_PATH}/claude-${ISSUE}.log"

# Create worktree (new branch or existing)
if [ -d "$WORKTREE_PATH" ]; then
    echo "🌳 Worktree already exists at $WORKTREE_PATH, reusing..."
else
    echo "🌳 Creating worktree..."
    if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
        git worktree add "$WORKTREE_PATH" "$BRANCH_NAME"
    else
        git worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME"
    fi
fi

# Kill existing session if any
tmux kill-session -t "task-${ISSUE}" 2>/dev/null || true

# Create tmux session
tmux new-session -d -s "task-${ISSUE}" -c "$WORKTREE_PATH"
tmux set -g mouse on

# Main pane: Claude auto-accept, output to log
tmux send-keys -t "task-${ISSUE}" "claude \"
## Task
Implement the requirements from GitHub issue #${ISSUE}.

If you are working with python, make sure you are creating a virtual environment and installing dependencies (make install_dev && make generate).

## Steps
1. First, read the issue: gh issue view ${ISSUE}
2. Understand the requirements and acceptance criteria
3. Implement the solution
4. Write/update tests if applicable
5. Run tests to verify
6. make sure linting and formatting checks pass (e.g. make py_format, mvn spotless:apply, etc.), for python linting make sure the virtual environment is activated before running linting commands
7. Commit with message describing the changes referencing issue ${ISSUE}
8. Push: git push -u origin HEAD
9. Create PR with a thorough description of the changes: gh pr create --title '#${ISSUE}: \<title\>' --body 'Closes #${ISSUE}'
10. Summarize what you accomplished
\"; echo '✅ Claude finished. Closing in 5s...'; sleep 5; tmux kill-session -t task-${ISSUE}" Enter

# Right pane: Live diff (colored)
tmux split-window -h -t "task-${ISSUE}" -c "$WORKTREE_PATH"
tmux send-keys -t "task-${ISSUE}" "watch -c -n 2 'echo \"📊 Changes vs HEAD\"; echo; git diff --color=always --stat; echo; echo \"📜 Commits\"; git log --oneline -5 2>/dev/null || echo \"None yet\"'" Enter

# Bottom-left pane: Git status
tmux select-pane -t "task-${ISSUE}.0"
tmux split-window -v -t "task-${ISSUE}" -c "$WORKTREE_PATH"
tmux send-keys -t "task-${ISSUE}" "watch -n 2 'echo \"📝 Status\" && git status -s'" Enter

# Focus on log pane (easier to watch)
tmux select-pane -t "task-${ISSUE}.1"

echo "🚀 Launching tmux session: task-${ISSUE}"
echo "   Worktree: $WORKTREE_PATH"
echo "   Log file: $LOG_FILE"

# Attach to session
tmux attach -t "task-${ISSUE}"