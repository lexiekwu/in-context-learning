# /go — Implement Pending PM Requests

This skill reads the PM's pending requests and implements them.

## Workflow

1. Read `docs/spec/pending_pm_requests.md` for pending items
2. Read `docs/spec/completed_pm_requests.md` to see what's already done
3. Read `docs/spec/questions_for_pm.md` to check for any answered questions
4. For each pending request:
   - Implement the feature
   - When done, **delete** the request from `docs/spec/pending_pm_requests.md` and add it (with your update notes) to `docs/spec/completed_pm_requests.md`
   - If blocked, write your question to `docs/spec/questions_for_pm.md` and move on
5. Whenever features are parallelizable, use multiple agents (Task tool) to implement them concurrently
6. Run `npx vitest run` before pushing to ensure all tests pass
7. Run `npx tsc --noEmit` to verify no type errors
