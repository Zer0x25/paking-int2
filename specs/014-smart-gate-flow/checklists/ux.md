# UX Requirements Checklist: Flujo inteligente de patente en Garita

**Purpose**: Review the completeness and clarity of the gate search and movement requirements.
**Created**: 2026-10-18
**Feature**: [spec.md](../spec.md)

**Note**: This custom checklist is a reviewer-owned requirements-quality artifact. Items remain unchecked until a reviewer evaluates the requirement wording.

## Requirement Completeness

- [ ] CHK001 Does the spec define which active sessions can appear in the search results and exclude other facilities? [Completeness] [Spec §FR-007]
- [ ] CHK002 Does the spec define the information shown for each suggestion so an operator can distinguish similar plates? [Completeness] [Spec §US2/AC2]
- [ ] CHK003 Does the spec state how the UI behaves while active sessions are initially loading? [Completeness] [Spec §FR-010]

## Requirement Clarity

- [ ] CHK004 Is the match rule precise about normalized prefix matching and the maximum number of results? [Clarity] [Spec §FR-007]
- [ ] CHK005 Is the boundary between selecting a suggestion and explicitly registering an exit unambiguous? [Clarity] [Spec §FR-006, FR-008]
- [ ] CHK006 Is it clear that a valid non-active plate goes to the existing destination confirmation before an entry is stored? [Clarity] [Spec §FR-003, FR-004]

## Scenario and Edge Case Coverage

- [ ] CHK007 Do the requirements cover exact active matches, partial matches, unmatched valid plates, invalid plates, and a list-load delay? [Coverage] [Spec §US1, US2]
- [ ] CHK008 Do the requirements define keyboard selection and assistive-technology announcement for suggestions? [Accessibility] [Spec §FR-012]
- [ ] CHK009 Do the requirements preserve online/offline operation and explain how stale-session conflicts are surfaced? [Recovery] [Spec §FR-011, FR-013]

## Non-Functional Requirements

- [ ] CHK010 Is client-side filtering and the absence of a network request per keystroke specified clearly enough to verify? [Performance] [Spec §FR-015]
- [ ] CHK011 Are the supported mobile viewport and touch/keyboard interaction requirements stated? [Responsive] [Spec §SC-006]
