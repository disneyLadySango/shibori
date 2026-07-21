# Shibori

Shibori is a focus portfolio for learning. It keeps multiple learning purposes, target states, and current understanding separate, then recommends the one next thing worth your focus. You can begin with curiosity alone and discover what you want to be able to do through learning.

Built for the OpenAI Build Week Education track. The public demo opens in English at `/`; the complete Japanese experience remains available at `/ja`. Both languages share the same locally stored learning state.

## Try the live demo

Open [shibori-xi.vercel.app](https://shibori-xi.vercel.app/)—no account or credentials are required.

1. Review the learning purposes and the recommended focus.
2. Select a purpose and inspect its learning path.
3. Load the built-in sample material and choose **Allocate my focus**.
4. Play the personalized listening lesson and answer the understanding check.
5. Submit an incomplete answer to see one actionable gap feed back into the next allocation.

## What Shibori does

1. Start exploring from a learning purpose, or declare a target state as a Can.
2. See the dependencies and your current position on the path.
3. Let GPT-5.6 recommend one next focus, with a reason.
4. Reshape material into either a listenable explanation or one desk problem.
5. Check understanding from an answer, preserving what worked and isolating one gap.
6. Reinforce now or later, then return to the saved learning position.
7. Resume the same position, focus, and gaps after closing the browser.
8. Keep multiple purposes without mixing their paths or understanding states.
9. Receive one cross-purpose recommendation while retaining the final decision.

Shibori narrows the recommendation to one, but never takes the learner's choice away. Reading or listening alone is never treated as proof of understanding.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `OPENAI_API_KEY` in `.env.local`. Without it, the built-in sample still demonstrates exploration, planning, checking, and reinforcement.

## OpenAI integration

- `gpt-5.6`: proposes the learning path, current position, next focus, and one understanding check with strict structured output
- `gpt-5.6`: recommends one purpose from a multi-purpose portfolio, with an explicit reason
- `gpt-5.6`: evaluates what an answer demonstrates and isolates at most one actionable gap
- `gpt-5.6`: reshapes arbitrary material around the learner's available focus
- `gpt-4o-mini-tts`: turns English or Japanese listening scripts into speech; it is kept separate from LLM decisions

The OpenAI boundary lives in [`lib/openai.ts`](lib/openai.ts), cross-purpose allocation in [`lib/prioritization.ts`](lib/prioritization.ts), state isolation in [`lib/portfolio.ts`](lib/portfolio.ts), and learning-state transitions in [`lib/learning.ts`](lib/learning.ts). The API key is only read server-side.

```text
Learning purposes -> GPT-5.6: one recommendation -> learner decides
                                                        |
Selected purpose --+-> exploration -> discover a Can --+
                   +-> target state (Can) --------------+-> path / position
Understanding and gaps ---------------------------------+
                                                        v
                                             GPT-5.6: next focus
                                                        |
Material ---------------------------> listening / desk <-+
                                                        v
                                             understanding check
                                               /              \
                                         demonstrated          gap
                                               |        reinforce now/later
                                               +------> reallocate and resume
```

## How Codex accelerated the work

Codex was the implementation agent throughout Shibori's Build Week development. We first used it to turn the product premise into a ubiquitous language, a user-story map, per-story acceptance criteria, and observable test specifications. Once those outcomes were approved, Codex projected them into the application rather than inventing product intent inside the code.

Codex then helped us:

- implement the learning loop as tested vertical slices;
- design strict GPT-5.6 structured-output boundaries for learning paths, recommendations, checks, and gap assessments;
- preserve independent state across multiple learning purposes and languages;
- run automated tests, linting, type checks, production builds, and browser-level demo verification;
- record durable engineering choices in architecture decision records; and
- prepare the Vercel deployment, English judging flow, screenshots, and narrated demo video.

The key product decisions remained human-owned: recommend one focus without taking away learner choice, distinguish exposure from demonstrated understanding, and preserve each learning purpose independently. Codex owned how those approved decisions became a tested working system.

## Origin and roadmap

[`origin/`](origin/) is the single source of truth for product intent and outcomes. It separates the ubiquitous language, individual user stories, one story map and roadmap, acceptance criteria for each story, and observable test specifications for each implementation approach. Durable engineering choices live in [`decisions/`](decisions/).

## Build Week assets

- [`docs/DEVPOST_SUBMISSION.md`](docs/DEVPOST_SUBMISSION.md)
- [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md)
- [`LICENSE`](LICENSE)

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## License

MIT
