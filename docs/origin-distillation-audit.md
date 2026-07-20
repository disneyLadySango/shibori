# Origin distillation audit

Date: 2026-07-20
Status: initial draft, awaiting human approval

## Source projections inspected

- Product implementation under `app/` and `lib/`
- `README.md`
- `docs/DEVPOST_SUBMISSION.md`
- `docs/DEMO_SCRIPT.md`
- User feedback in the implementation session
- Uncommitted learning-roadmap projection on `feature/shibori-learning-loop`

## Traceability

| Observed projection | Distilled origin | Assessment |
| --- | --- | --- |
| Three onboarding questions | Learning purpose, learner, learning domain | Preserves part of the intent but assumes one domain |
| Ear/desk classification | Focus resource, light focus, deep focus, allocation | Strong vertical slice for attention depth |
| One desk exercise | One current focus, understanding evidence | Initial version lacked actual evidence; PR #2 adds it |
| Gap list and refresher | Gap, reinforcement, reallocation | Existing projection changes content but not a visible overall learning path |
| Restored current session | Continuity after interruption | Covers one session, not a portfolio of domains |
| Uncommitted roadmap code | Learning path, current focus, multiple domains | Premature projection; no approved origin or tests existed |
| Build Week documents | External judging constraints | Not user pain; retained as AC/ADR constraints |

## Confirmed projection gaps

1. No approved representation of multiple simultaneous learning domains.
2. No approved rule for choosing one domain over another.
3. No visible relationship between current focus, prerequisites, and the learner's real-world purpose.
4. A gap changes the next generated content but not an observable overall learning path.
5. No definition of sufficient understanding evidence or mastery.
6. No outcome evidence that reduced choice improves learning initiation.
7. No validated success or retreat thresholds.

## Layer lint findings

- Existing product documents use solution terms such as roadmap, podcast, cards, structured output, and local storage. This is acceptable for projections but they must not be copied into layer 2.
- The user's requests for a roadmap and multiple registered fields are treated as evidence of pain, not yet as approved solutions.
- The uncommitted roadmap implementation introduced behavior before layer 4 approval. It remains frozen and must be either discarded or regenerated after origin approval.

## Required human decisions

1. Approve or edit the glossary.
2. Choose the primary release slice: Slice A first, or Slice A plus Slice B.
3. Answer the four intent questions in `origin/2-stories/open-questions.md`.
4. Approve the release order in `origin/2-stories/story-map.md`.
5. Approve or replace the success and retreat thresholds owned by each story's AC.
6. Promote selected layer 4 specifications from backlog after choosing an approach.
7. Decide which observed ADRs become active pins.

No new projection should be implemented until decisions 1–5 are complete.
