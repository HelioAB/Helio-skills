# Domain Modeling

Actively build and sharpen the project's domain model as you design. This is the *active* discipline: challenging terms, inventing edge-case scenarios, and writing the glossary and decisions down the moment they crystallise. (Merely *reading* `CONTEXT.md` for vocabulary is not this skill: that's a one-line habit any skill can do. This skill is for when you're changing the model, not just consuming it.)

## File structure

All docs live under one base directory B: `B/CONTEXT.md` and `B/adr/`; a multi-context repo keeps `B/CONTEXT-MAP.md` pointing to each context's own file inside its source subtree. SKILL.md settles B when docs mode activates — a user-named location wins, existing glossary and ADR files are followed where they live, a bare topic folder gets a topic-named subdirectory, and a project root with none of these is asked first. Everything is created lazily, at the first write. Layout details and formats: [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md) and [ADR-FORMAT.md](./ADR-FORMAT.md).

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `CONTEXT.md`, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y. Which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account': do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible. Which is right?"

### Update CONTEXT.md inline

When a term is resolved, update `CONTEXT.md` right there. Don't batch these up: capture them as they happen. Use the format in [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md).

`CONTEXT.md` should be totally devoid of implementation details. Do not treat `CONTEXT.md` as a spec, a scratch pad, or a repository for implementation decisions. It is a glossary and nothing else.

### Offer ADRs sparingly

Apply the three criteria in [ADR-FORMAT.md](./ADR-FORMAT.md) — hard to reverse, surprising without context, the result of a real trade-off. If any is missing, skip the ADR.
