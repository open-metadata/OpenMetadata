#!/usr/bin/env bash
# Claude Code hooks (registered in .claude/settings.json) that keep
# .github/java-tests/impact-map.json owning the code agents add. The agent that creates a
# file owns it in the map, before the PR exists:
#   written  PostToolUse on Write: a Java or schema file no area owns is reported back to
#            the agent, with the glob to add and the likely area, so it fixes the map in the
#            same turn.
#   pre-pr   PreToolUse on Bash: `git push` and `gh pr create` are blocked while the commit
#            they send leaves code or ITs without an area, empties a pattern, or breaks a map
#            rule. Uncommitted and untracked files don't count: they aren't pushed.
# Each check runs the planner of the checkout the file or push belongs to, and only when
# that planner has the check. Without python3 the hooks step aside rather than block.
set -u
mode="${1:-}"
command -v python3 >/dev/null 2>&1 || exit 0
input="${CLAUDE_TOOL_INPUT:-$(cat)}"

# A field of the tool call: hooks get the call on stdin ({"tool_input": {...}}) or, from
# older Claude Code releases, the tool input itself in $CLAUDE_TOOL_INPUT.
field() {
  printf '%s' "$input" | python3 -c '
import json, sys
try:
    call = json.load(sys.stdin)
except ValueError:
    sys.exit()
args = call.get("tool_input", call) if isinstance(call, dict) else {}
value = args.get(sys.argv[1], "") if isinstance(args, dict) else ""
print(value if isinstance(value, str) else "")
' "$1"
}

# The checkout's root, when its planner has the given check (an older copy has neither).
planner_root() {
  local root
  root=$(git -C "$1" rev-parse --show-toplevel 2>/dev/null) || return 1
  grep -q -- "$2" "$root/.github/scripts/plan_local_java_tests.py" 2>/dev/null || return 1
  printf '%s' "$root"
}

case "$mode" in
  written)
    file=$(field file_path)
    case "$file" in
      */src/main/resources/ui/* | */node_modules/*) exit 0 ;;
      *.java | */src/main/* | */bootstrap/* | */conf/*) ;;
      *) exit 0 ;;
    esac
    root=$(planner_root "$(dirname "$file")" --check-owner) || exit 0
    out=$(cd "$root" && python3 .github/scripts/plan_local_java_tests.py --check-owner "$file" 2>&1) && exit 0
    ;;
  pre-pr)
    cmd=$(field command)
    printf '%s' "$cmd" | grep -qE '(^|[;&|(]|[[:space:]])(git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+push|gh[[:space:]]+pr[[:space:]]+create)([[:space:]]|$)' || exit 0
    printf '%s' "$cmd" | grep -qE -- '--delete|--tags' && exit 0
    dir=$(printf '%s' "$cmd" | sed -nE 's/.*git[[:space:]]+-C[[:space:]]+"?([^"[:space:]]+)"?[[:space:]]+push.*/\1/p' | head -n 1)
    [ -n "$dir" ] || dir=$(printf '%s' "$cmd" | sed -nE 's/^[[:space:]]*cd[[:space:]]+"?([^"&;|[:space:]]+)"?.*/\1/p' | head -n 1)
    dir="${dir:-${CLAUDE_PROJECT_DIR:-$PWD}}"
    case "$dir" in
      \~) dir="$HOME" ;;
      \~/*) dir="$HOME/${dir#\~/}" ;;
    esac
    root=$(planner_root "$dir" '"--head"') || exit 0
    base=$(printf '%s' "$cmd" | sed -nE 's/.*gh[[:space:]]+pr[[:space:]]+create.*--base[[:space:]=]+"?([^"[:space:]]+)"?.*/\1/p' | head -n 1)
    # Check the commit the command sends, not the working tree: the branch
    # `gh pr create --head` names, or the source of `git push`'s first refspec; else HEAD.
    if printf '%s' "$cmd" | grep -qE 'gh[[:space:]]+pr[[:space:]]+create'; then
      sent=$(printf '%s' "$cmd" | sed -nE 's/.*--head[[:space:]=]+"?([^"[:space:]]+)"?.*/\1/p' | head -n 1)
      sent="${sent##*:}"
    else
      args=$(printf '%s' "$cmd" | sed -nE 's/.*git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+push([[:space:]].*)?$/\2/p' | head -n 1)
      args="${args%%[;&|]*}"
      sent="" positional=0 value=0
      set -f
      # shellcheck disable=SC2086 # split the push arguments into words
      for word in $args; do
        if [ "$value" -eq 1 ]; then value=0; continue; fi
        case "$word" in
          # The options git push reads a value for from the next word.
          -o | --push-option | --repo | --receive-pack | --exec) value=1; continue ;;
          -*) continue ;;
        esac
        positional=$((positional + 1))
        if [ "$positional" -eq 2 ]; then
          sent="${word%%:*}"
          sent="${sent#+}"
          break
        fi
      done
      set +f
    fi
    head=HEAD
    # Never a remote-tracking ref: a remote's name taken for the source resolves to the base,
    # so the check would compare the base with itself and pass.
    if [ -n "$sent" ] && git -C "$root" rev-parse --verify --quiet "$sent^{commit}" >/dev/null &&
      ! git -C "$root" rev-parse --symbolic-full-name "$sent" | grep -q '^refs/remotes/'; then
      head="$sent"
    fi
    out=$(cd "$root" && python3 .github/scripts/plan_local_java_tests.py --check-branch --base "origin/${base:-main}" --head "$head" 2>&1) && exit 0
    ;;
  *) exit 0 ;;
esac
printf '%s\n' "$out" >&2
exit 2
