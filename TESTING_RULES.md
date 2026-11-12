SOFTWARE QUALITY ASSURANCE & TESTING RULES
Mandatory Testing Policy for the MVP
Document: TESTING_RULES.md
Purpose: Comprehensive software quality assurance before management demonstrations and production releases.
Applies to: All future testing sessions initiated through Claude Code.

1. MANDATORY INSTRUCTIONS
Whenever the user requests software testing, you MUST:

Read this entire file before starting.
Inspect the current application architecture.
Identify the available testing tools and environments.
Create three specialized testing agents.
Execute all three testing phases.
Perform at least 150 distinct test attempts per phase.
Aim to discover at least 20 genuine defects per phase through systematic investigation.
Document all discovered defects with reproducible evidence.
Fix discovered defects where authorized.
Retest all fixes.
Generate a comprehensive testing report.
These rules are mandatory unless the user explicitly requests a smaller testing scope.

IMPORTANT: Never invent defects to meet the target of 20. The target is an investigation goal, not a requirement to fabricate problems. If fewer than 20 genuine defects exist, report the actual findings and explain the remaining coverage.

Never report a test as successful unless it was actually executed and its result verified.

2. THREE-AGENT TESTING ARCHITECTURE
Create three independent specialized testing agents.

All three agents should work simultaneously whenever the environment supports parallel agents.

Each agent has a separate testing responsibility.

AGENT 1: BACKEND TESTING SPECIALIST
Testing level: LEVEL 1 – BACKEND

Role: Senior Backend QA Engineer.

Objective: Identify backend bugs, security weaknesses, data integrity problems, API failures, and business logic errors.

Testing responsibilities
A. API Testing

Test all available API endpoints.
Test valid requests.
Test invalid requests.
Test missing parameters.
Test incorrect data types.
Test boundary values.
Test empty requests.
Test malformed requests.
Test HTTP status codes.
Test response structures.
Test error handling.
Test pagination.
Test filtering and sorting.
Test concurrent requests where appropriate.
B. Database Testing

Verify data persistence.
Verify data consistency.
Test create, read, update, and delete operations.
Test relationships between entities.
Check for duplicate records.
Test missing and null values.
Test database constraints.
Check transaction handling.
Verify rollback behavior.
Check for orphaned records.
Test migrations where applicable.
C. Authentication and Authorization

Test login and logout.
Test invalid credentials.
Test expired sessions.
Test unauthorized requests.
Test role-based permissions.
Test access restrictions.
Test session handling.
Verify that users cannot access other users' restricted data.
D. Business Logic

Test every important business rule.
Test questionnaire submission logic.
Test Kudos functionality.
Test employee-related workflows.
Test status changes.
Test calculations.
Test duplicate submissions.
Test edge cases.
Test invalid state transitions.
E. Security

Review input validation.
Check access control.
Check for insecure direct object references.
Review sensitive data exposure.
Check for common injection vulnerabilities using safe, non-destructive test cases.
Review error messages for information leakage.
Verify secure handling of authentication tokens.
Minimum requirements
At least 150 distinct test attempts.
Target at least 20 verified defects.
Test all important backend modules.
Record actual results.
Provide evidence for every defect.
AGENT 2: FRONTEND TESTING SPECIALIST
Testing level: LEVEL 2 – FRONTEND

Role: Senior Frontend QA Engineer and UI/UX Quality Specialist.

Objective: Identify frontend bugs, broken interactions, usability problems, visual inconsistencies, and responsiveness issues.

Testing responsibilities
A. Navigation

Test every navigation item.
Test all application routes.
Test browser back and forward.
Test direct URL access.
Test page refresh.
Test switching between sections.
Test navigation while loading.
Test rapid navigation.
Test active navigation indicators.
Test missing routes.
B. UI Components

Test every button.
Test dropdowns.
Test modals.
Test forms.
Test tables.
Test cards.
Test search functionality.
Test filters.
Test pagination.
Test tooltips.
Test notifications.
Test empty states.
C. Forms and Questionnaires

Test valid submissions.
Test missing required fields.
Test invalid inputs.
Test maximum and minimum values.
Test special characters.
Test long text.
Test repeated submissions.
Test validation messages.
Test loading states.
Test successful completion.
Test failed submissions.
D. Animations and Interactions

Test questionnaire confetti.
Test page transitions.
Test button animations.
Test hover effects.
Test modal transitions.
Test dropdown animations.
Test loading animations.
Test success animations.
Test Kudos animations.
Test reduced-motion behavior.
Verify that animations do not cause:

Flickering.
Layout shifts.
Clipped content.
Broken interactions.
Excessive delays.
Performance problems.
E. Responsive Design

Test at multiple viewport sizes.

Include:

Desktop.
Laptop.
Tablet.
Mobile.
Check:

Layout alignment.
Text overflow.
Horizontal scrolling.
Navigation behavior.
Form usability.
Table responsiveness.
Modal positioning.
Button accessibility.
F. Visual Quality

Check inconsistent spacing.
Check typography.
Check colors.
Check alignment.
Check image rendering.
Check icons.
Check overlapping elements.
Check missing content.
Check loading indicators.
Check visual consistency across pages.
G. Accessibility

Keyboard navigation.
Focus indicators.
Color contrast.
Semantic elements.
Form labels.
Accessible error messages.
Reduced-motion support.
Minimum requirements
At least 150 distinct test attempts.
Target at least 20 verified defects.
Test all main pages.
Test all important interactions.
Record actual results and evidence.
AGENT 3: FULL SYSTEM INTEGRATION TESTING SPECIALIST
Testing level: LEVEL 3 – END-TO-END

Role: Senior Software QA Automation Engineer.

Objective: Verify that the complete application works correctly when frontend, backend, database, authentication, and business workflows operate together.

This agent must test the application as a real employee would use it.

Testing responsibilities
A. Complete User Journeys

Test complete workflows from beginning to end.

Examples:

User logs in.
User navigates to the dashboard.
User opens a questionnaire.
User fills out the questionnaire.
User submits the questionnaire.
Backend processes the submission.
Database stores the information.
Frontend displays confirmation.
Confetti animation appears.
User navigates to another section.
Test the entire sequence.

B. Kudos Workflow

Test:

Opening Kudos.
Viewing received Kudos.
Selecting a colleague.
Writing a message.
Sending Kudos.
Backend processing.
Database persistence.
Confirmation notification.
Displaying the sent Kudos.
Displaying received Kudos to the intended recipient.
C. Authentication Workflows

Test:

Login.
Logout.
Session expiration.
Page refresh.
Protected routes.
Different user roles.
Access restrictions.
D. Data Consistency

Verify:

Frontend data matches backend data.
Submitted information is persisted.
Updated information is displayed correctly.
Deleted information disappears where expected.
Different users see the correct information.
No duplicate records are created accidentally.
E. Error Handling

Test:

Backend unavailable.
Network interruption.
Slow responses.
Failed API requests.
Invalid server responses.
Expired sessions.
Repeated submissions.
Interrupted workflows.
Verify that users receive understandable feedback and that the application does not enter a broken state.

F. Multi-user Scenarios

Where supported by the test environment:

Test multiple users.
Test different permission levels.
Test concurrent updates.
Test simultaneous submissions.
Test data isolation.
Test conflicting operations.
G. Complete Application Regression

Verify that important existing workflows continue working after frontend or backend changes.

Minimum requirements
At least 150 distinct test attempts.
Target at least 20 verified defects.
Test complete user journeys.
Verify frontend/backend communication.
Verify database persistence.
Document all failures and evidence.
3. TEST EXECUTION RULES
Each agent must follow these rules.

Rule 1 – Minimum Test Attempts
Each testing phase must execute at least 150 distinct test attempts.

Total minimum:

Backend: 150+
Frontend: 150+
Integration: 150+
TOTAL: 450+ test attempts.

A test attempt must represent an actual executed test with a recorded result.

Do not count the same unchanged test repeatedly to inflate the numbers.

Different meaningful input variations and test conditions are allowed.

Rule 2 – Investigation Target
Each agent should aim to discover at least 20 genuine defects.

Investigate deeply rather than stopping after finding the first few problems.

However:

Never fabricate defects.
Never classify expected behavior as a bug.
Never report speculative problems as confirmed.
Distinguish confirmed defects from potential risks.
Rule 3 – Evidence
Every confirmed defect must contain:

Unique defect ID.
Testing phase.
Affected page or component.
Description.
Steps to reproduce.
Expected result.
Actual result.
Severity.
Supporting evidence.
Reproduction status.
Rule 4 – Safe Testing
Perform testing only against systems and environments that are authorized for testing.

Prefer a dedicated test environment and test accounts.

Never:

Delete real company data.
Send test emails or notifications to real employees without authorization.
Perform destructive production database operations.
Modify real user permissions without authorization.
Expose real employee information in test reports.
Run uncontrolled load tests against production.
Attempt destructive security exploitation.
Use isolated test data and clean up generated records when appropriate.

Rule 5 – Independent Testing
Agents should independently evaluate their assigned areas.

Do not assume that another agent's successful test proves your own area works.

Share findings when necessary, but maintain separate test records.

4. SEVERITY CLASSIFICATION
Classify every defect using the following levels.

CRITICAL
Data loss.
Unauthorized access to sensitive information.
Authentication bypass.
Major security vulnerabilities.
Application completely unusable.
HIGH
Important functionality broken.
Major workflow failure.
Incorrect data persistence.
Serious permission issues.
Significant integration failures.
MEDIUM
Partial functionality failure.
Incorrect validation.
Broken UI interactions.
Inconsistent data display.
Significant usability problems.
LOW
Minor visual defects.
Small spacing inconsistencies.
Minor animation issues.
Non-critical UI problems.
INFORMATIONAL
Improvement recommendations.
Non-blocking optimization opportunities.
Design suggestions.
Do not classify visual preferences as functional defects.

5. TESTING WORKFLOW
Follow this sequence.

Phase 1 – Preparation
Read this policy.
Inspect the project.
Identify testing tools.
Identify application architecture.
Identify available environments.
Prepare isolated test data.
Create three agents.
Phase 2 – Parallel Testing
Start all three agents simultaneously.

Each agent performs its own 150+ test attempts.

Agents must document their progress and findings.

Phase 3 – Findings Consolidation
Collect all agent reports.

Identify:

Confirmed defects.
Duplicate findings.
Potential risks.
Missing test coverage.
Critical issues.
Merge duplicate defects into one record while preserving evidence from each agent.

Phase 4 – Bug Fixing
After testing:

Prioritize critical and high-severity issues.
Fix confirmed defects where authorized.
Avoid unrelated refactoring.
Preserve existing functionality.
Document code changes.
If fixes could interfere with another agent's work, coordinate before modifying shared files.

Phase 5 – Retesting
Every fixed defect must be retested.

Perform regression tests on affected workflows.

A defect is not resolved merely because code was changed.

Phase 6 – Final Verification
Verify:

Application builds successfully.
Tests pass.
Critical workflows work.
No critical or high-severity defects remain unresolved.
Application starts successfully.
6. REQUIRED REPORTING STRUCTURE
Create a directory:

testing/reports/

For each full testing session, create a uniquely named report directory.

Include the following files:

1. SUMMARY.md
Executive summary:

Overall testing result.
Total test attempts.
Passed tests.
Failed tests.
Blocked tests.
Confirmed defects.
Severity distribution.
Remaining risks.
Release recommendation.
2. BACKEND_REPORT.md
Agent 1 findings and test results.

3. FRONTEND_REPORT.md
Agent 2 findings and test results.

4. INTEGRATION_REPORT.md
Agent 3 findings and test results.

5. BUG_REGISTER.md
Centralized defect register.

Use a table containing:


ID	Phase	Description	Severity	Status
BUG-001	Backend	Description	High	Open
6. TEST_CASES.md
List all executed test cases.

Each test must include:

Test ID.
Description.
Preconditions.
Test steps.
Expected result.
Actual result.
Status.
Evidence reference.
7. FIXES.md
Document:

Defects fixed.
Files modified.
Fix descriptions.
Retesting results.
Remaining issues.
8. RELEASE_READINESS.md
Provide an honest assessment of whether the application is ready for demonstration to management.

7. RELEASE READINESS CRITERIA
Use these criteria when assessing the MVP.

PASS
All critical workflows work.
No unresolved critical defects.
No unresolved high-severity defects affecting core workflows.
Authentication and permissions work.
Database integrity is verified.
Frontend is functional.
Integration tests pass.
Build succeeds.
Application starts successfully.
CONDITIONAL PASS
No critical defects.
Some medium or low defects remain.
Core functionality works.
Remaining risks are documented and accepted.
FAIL
Critical defects remain.
Important workflows are broken.
Data integrity is compromised.
Authentication or permissions are unreliable.
Application cannot start or operate reliably.
Do not recommend a release merely because the minimum number of tests was executed.

Quality and verified results matter more than the number of test attempts.

8. FINAL RULE
The goal is to prepare this MVP for a professional demonstration to company management.

Think like a critical external software auditor.

Do not assume that the software works because it looks good.

Try unusual but realistic workflows, invalid inputs, boundary conditions, interrupted operations, and unexpected user behavior.

Be thorough, skeptical, and evidence-driven.

The application must earn a passing result through testing. It must never receive a passing result simply because the developer believes it works.

When the user says "Run a full system test", automatically follow this entire policy without requiring the user to repeat these instructions.

3. How to activate it in Claude Code
Once you save the file, use this instruction:

Writing


Read TESTING_RULES.md from the project root and execute a complete system test according to its requirements.

Create and coordinate all three specialized testing agents. Run backend, frontend, and end-to-end integration testing in parallel.

Execute at least 150 distinct test attempts per phase. Investigate thoroughly for genuine defects, document all findings with evidence, fix confirmed issues where authorized, and retest.

Generate all required testing reports inside testing/reports/.

Do not fabricate test results or defects. Do not skip any testing phase.

At the end, give me an honest release-readiness assessment for presenting the MVP to company management.

4. One additional recommendation: keep a testing history
I would also introduce this folder structure:


text
project/
│
├── TESTING_RULES.md
│
├── testing/
│   ├── reports/
│   │   ├── 2026-11-12_001/
│   │   │   ├── SUMMARY.md
│   │   │   ├── BACKEND_REPORT.md
│   │   │   ├── FRONTEND_REPORT.md
│   │   │   ├── INTEGRATION_REPORT.md
│   │   │   ├── BUG_REGISTER.md
│   │   │   ├── TEST_CASES.md
│   │   │   ├── FIXES.md
│   │   │   └── RELEASE_READINESS.md
│   │   │
│   │   └── future-test-runs/
│   │
│   └── test-data/
│
└── src/
