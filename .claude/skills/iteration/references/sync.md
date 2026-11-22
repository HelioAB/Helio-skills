# main 前进时的同步

工作项活到 UAT 结束期间 `main` 可能前进。agent 在 UAT 前或合并前自动检查，并在 worktree 内 `git fetch origin` + `git merge origin/main`，再 push；**不 rebase、不 force push**。最终仍由 GitHub 的 rebase merge 保持 `main` 线性。只有用户明确允许时才用 `git rebase origin/main` + `git push --force-with-lease`。同步由 agent 处理，不是用户触发词。
