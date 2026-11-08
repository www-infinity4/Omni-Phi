# Podcast Widget Fix Plan

**Objective:**  
Provide a verbatim, step‑by‑step implementation plan to address the response handling issue in `code/podcast-widget.js` and ensure the changes can be reviewed, tested, and merged through the standard GitHub workflow.

**Scope:**  
- No production code will be modified in this job; only the plan document is created.  
- The plan will be written to `docs/podcast-widget-fix-plan.md` and committed to the repository.

## 1. Inspection (Red & Yellow)

1. Clone the repository at the pinned head (`12b8f3052bdcf6b3781c9a012d912d4c25ddf6e8`).  
2. Open `code/podcast-widget.js` and its test file `code/podcast-widget.test.cjs`.  
3. Identify the current logic for:
   - `normalize` – how the raw API response is transformed.  
   - `apply` – how the normalized data is stored in the widget state.  
   - `audit` – any validation or error handling performed.  
   - UI rendering – how success, error, and paid‑episode messages are displayed.

## 2. Draft Implementation Plan (Blue)

Create a markdown file `docs/podcast-widget-fix-plan.md` containing the following sections:

### 2.1 Problem Statement
- Summarize the observed defect (e.g., missing validation of the `status` field, UI not reflecting paid‑episode state, incorrect error messages).

### 2.2 Code Changes (proposed snippets)
- **normalize** – add a guard that checks required fields and returns a standardized error object.
- **apply** – update the state mutation to handle the new error object and set a `hasError` flag.
- **audit** – introduce a validation step that logs unexpected values and returns a boolean.
- **UI Rendering** – modify the template to show a distinct “Paid episode” badge and an error banner when `hasError` is true.

Provide the exact code snippets (diff‑style or inline) that will be inserted.

### 2.3 Test Updates
- Add a test case that feeds a malformed response and asserts that `hasError` becomes true and the error banner appears.
- Add a test case for a paid‑episode response and assert that the badge is rendered.
- Ensure existing tests still pass.

### 2.4 PR Workflow
1. Create a new branch `fix/podcast-widget-response`.
2. Commit the plan file (`docs/podcast-widget-fix-plan.md`) with message `docs: add fix plan for podcast widget response handling`.
3. Open a Pull Request targeting `main` with the title *Fix podcast widget response handling*.
4. Request review from the repository maintainers.
5. Once approved, merge with the “Squash and merge” option.

### 2.5 Deployment Verification
- After merge, the CI pipeline will run the test suite (`node --test code/podcast-widget.test.cjs`).  
- Verify that the CI status is green.  
- If the repository uses GitHub Pages or a deployment step, confirm that the latest build includes the updated widget and that the UI behaves as expected in a manual smoke test.

## 3. Execute Tests (Green)

Run the existing test suite before any code change to capture baseline output:

```bash
node --test code/podcast-widget.test.cjs
```

Record the console output in the job report. All tests must pass.

## 4. Independent Review (Pink)

- A second reviewer (Pink role) will read the markdown file, confirm that:
  - The plan follows the owner’s request for a verbatim description.
  - All required sections are present.
  - No production code is altered at this stage.
- The reviewer signs off in the PR comments.

## 5. Final Reporting (Black)

- Commit the plan file.  
- Attach the test output from step 3.  
- Summarize the PR workflow and note any missing credentials or authorizations (e.g., write permission to the repository).  
- If any blocker is encountered, report it with details.

---

**Note:** This document is the only change introduced by the current job. All subsequent code modifications will be performed only after the owner explicitly authorizes them in a follow‑up task.  

*Prepared by the Green engineer for ticket IW-20261108-FF0255CC.*