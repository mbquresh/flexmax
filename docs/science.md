[Back to the README](../README.md)

# The science underneath FlexMax

What each design decision rests on, how well-supported it is, and where the
product is making a bet the literature does not settle.

This document exists so that future changes can be checked against the reason
a thing was built that way. Several decisions here look arbitrary and are not.
At least one looks like an improvement waiting to happen and would break the
product.

**Read [behavioral-engine.md](behavioral-engine.md) for how the engine works.
This is why it works that way.**

---

## Confidence levels used below

- **Established** — replicated, meta-analysed, survives scrutiny
- **Supported** — good evidence, some contest
- **Bet** — plausible, untested, ours to prove or disprove
- **Arbitrary** — chosen, not derived; change freely if data says so

---

## 1. The recurring block is an implementation intention

**Established.**

Gollwitzer's implementation intentions — "when situation X arises, I will
perform Y" — are among the better-replicated findings in behavioural
psychology. The Gollwitzer & Sheeran (2006) meta-analysis covered roughly 94
independent studies and found a medium-to-large effect, unusual for an
intervention this cheap.

The mechanism is delegation. Specifying the cue moves initiation from
deliberate intention to environmental trigger. The person stops deciding and
starts responding.

**What this means for the product.** A recurring block — "Gym, Monday, 6pm" —
is structurally identical to the format used in that research. A task with a
due date is not: a deadline is a constraint, not a cue.

This is the deepest justification for the block/task split. The block is the
implementation intention. The task is what fills it. Inverting that — making
tasks primary and blocks a container for them — would remove the mechanism.

**Do not** let tasks become the primary unit. See §9.

---

## 2. Habits form from repetition in a *stable context*

**Established.**

Wood & Neal on habit, and Lally et al. (2010) on automaticity, converge:
automaticity comes from strengthening a context-behaviour association, not
from frequency alone. Same cue, same behaviour, repeatedly.

Lally's median time to automaticity was around 66 days, with a range from 18
to 254. That variance is not noise — it is real individual difference.

**What this means for the product.**

- A behaviour that moves between contexts never automates, however often it is
  completed. This is the structural reason a task-first planner cannot build
  habits and a block-first one can.
- The engine will see wildly different formation curves across users. Any
  fixed "you should have this down by now" threshold would be wrong for most
  people. Judge each block against its own history, never against a calendar.

---

## 3. Recording a behaviour changes it, before any analysis

**Established.**

Self-monitoring reactivity — Kanfer, later Nelson & Hayes — is one of the
oldest reliable findings in behaviour therapy. The act of recording alters
what is recorded. Measurement is itself an intervention.

**What this means for the product.** The ledger works in week one for reasons
that have nothing to do with the engine. Every check-in is a measurement, and
measurement changes behaviour before a single insight has been generated.

This is a legitimate claim and it is the honest answer to "what does this do
for me before the engine has data?"

**The caveat that matters:** reactivity decays. Novelty of observation wears
off. The engine has to take over roughly where reactivity fades — which is
also roughly where the first weekly insight lands. That timing is fortunate
rather than designed, and it is worth watching in cohort data.

---

## 4. The accounted-for streak inverts the abstinence violation effect

**Supported, with a real tension.**

Standard streaks are engineered to trigger what Marlatt called the abstinence
violation effect and what Cochran & Tesser named the "what the hell" effect: a
single lapse gets reframed as total failure and the whole project is
abandoned. A 200-day streak breaking on day 201 does not produce a 1-day
streak. It produces a deleted app.

Attaching the streak to honesty rather than perfection targets this directly.
Supporting work: Adams & Leary found self-compassion after a dietary lapse
reduced subsequent overeating; Breines & Chen found it increased motivation to
improve rather than licensing failure.

**The tension is real and must be held.** The standing critique of
self-compassion research is that it shades into permission. The finding that
survives scrutiny is narrower than the popular version:

> Self-compassion helps **when paired with maintained standards.**
> Compassion *plus* standards works. Compassion *instead of* standards does not.

**What this means for the product.** The design walks that line deliberately:
the miss is recorded honestly and permanently, the standard does not move,
only the emotional framing changes.

The failure mode is real. If a user learns that tapping "no reason" preserves
everything, that is compassion without standards. What protects us is that the
evidence accumulates regardless — the miss enters the pattern whether or not
the streak survives, and the weekly insight will say so.

**Do not** add a way to preserve the streak that also removes the miss from
the record. That single change would convert a supported mechanism into a
known failure mode.

---

## 5. No audience: the largest unresolved bet in the product

**Bet.**

**For us.** Social desirability bias is thoroughly documented. People
systematically report to human observers a version of events that reflects
better on them. The founder's own experience — reporting a smoothed-over week
to a human accountability partner — is a textbook instance, and the
observation that the smoothed-over parts are exactly the diagnostic ones is
correct.

**Against us.** The efficacy of accountability comes substantially *from* the
observation. Public commitment reliably increases follow-through in the
goal-setting literature. Weigh-ins work because someone is watching. Removing
the audience removes the bias and the mechanism together.

No literature settles this. Our implicit answer is that the accumulated
evidence becomes the accountability — the record is the witness, and it does
not flatter.

**This is what the beta tests.** Not reflection fill rate — that is an input
metric. The question is whether a record that never judges produces adherence
comparable to one that does.

---

## 6. The recovery flow is coping planning

**Established, applied slightly wrong.**

Sniehotta et al. distinguish **action planning** ("I will do X at Y") from
**coping planning** ("if Z gets in the way, I will do W"). Coping planning
independently predicts maintenance — it is what separates people who resume
after a disruption from people who do not.

Most apps in this category offer action planning and nothing else. The
recovery flow — push, sacrifice, shrink, with the cost named before commit —
is coping planning, which is rare.

**Where we are weaker than the evidence supports.** Coping planning has
stronger backing when done *prospectively*. Deciding in advance what happens
when the morning goes beats deciding at 2:47pm.

We now have the data to offer this. The coupling table knows which block is at
risk when which trigger fails. A prospective coping plan — "when Deep work
morning goes, here is what happens to the afternoon" — is available and
unbuilt.

---

## 7. The preempt is a just-in-time adaptive intervention

**Supported, with two hard constraints.**

Nahum-Shani et al. formalised the JITAI framework in mobile health. Three
components are required: a tailoring variable, a decision rule, and a state of
receptivity.

The coupling table is a **vulnerability detector**, which is the hard part of
JITAI design and the reason most apps cannot build one. "Trigger failed,
later block is coupled and confirmed, later block has not started" is a
decision rule grounded in that user's own history.

**Two findings that constrain the build:**

1. **Poorly timed interventions cause disengagement** — worse than no
   intervention at all.
2. **Receptivity matters as much as need.** A correct nudge delivered when the
   person cannot act on it trains them to ignore all nudges.

**What this means for the product.** A warning delivered at the later block's
start is a correct message at a useless moment — there is no time left to act.
The coupled preempt needs a lead of roughly 30–45 minutes. This is not a
polish item; it is the difference between a JITAI and a notification.

The one-nudge-per-day cap is also a receptivity decision. See §10.

---

## 8. On the keystone finding: do NOT reach for ego depletion

**Important negative result.**

The founder data shows Deep work morning failing predicts Deep work afternoon
failing (10 of 15 vs 1 of 11, p ≈ 0.0002, survives Bonferroni at 72
comparisons, day-level control non-significant at p = 0.14, and the effect
*strengthens* when restricted to days Fajr completed — ruling out the obvious
sleep confounder).

The tempting explanation is ego depletion: willpower is a finite resource, the
morning drained it.

**Do not use it.** Ego depletion largely failed a major multi-lab replication
in 2016 (Hagger et al., 2,000+ participants, effect near zero). Building a
public claim on it invites a correction from anyone scientifically literate.

**Better-supported alternatives for the same data:**

- **Self-efficacy (Bandura).** Mastery experience is the strongest source of
  self-efficacy. A completed morning raises expectancy for the afternoon; a
  failed one lowers it. Predicts the exact pattern, far better replication.
- **Affect spillover.** Mood following success or failure carries forward into
  subsequent effort. Simpler, well-documented.
- **Schedule cascade.** Mechanical rather than psychological — the morning's
  disruption physically consumes the afternoon's time. Testable via
  `actual_end_minutes`, which nothing currently writes.

We cannot distinguish these from the data. All three are defensible.
Depletion is not.

**Copy rule that follows:** state the observation with both arms and both
counts. Never state the mechanism. "When your morning deep work goes, your
afternoon one goes with it — 10 of 15 times" is true under every candidate
explanation.

---

## 9. Feedback direction: the most consequential rule in the engine

**Established. This is the section to re-read before changing insight copy.**

Kluger & DeNisi (1996) meta-analysed feedback interventions. Average effect
positive — but **feedback made performance worse in over a third of cases.**
Feedback is not reliably helpful. It is reliably powerful, in both directions.

The variable determining the sign is **where the feedback directs attention**:

- Feedback directing attention to **the task** improves performance.
- Feedback directing attention to **the self** degrades it, because
  self-focused attention consumes the resources the task requires.

**What this means for the product.** Every insight must be about the block,
never about the person.

    GOOD: "Deep work morning has turned around — 5 of 7 in the last week."
    BAD:  "You have become more disciplined this week."

    GOOD: "Weights workout is the block most actively deteriorating."
    BAD:  "You are struggling with consistency."

This is already encoded in the narrator prompt as the quality-drift rule
("describes the block's trajectory, never the user's effort") and in the
insight schema, which attaches every belief to `related_blocks`.

**Warning for future-you.** Pressure to make insight copy more personal, more
motivational, more "you"-centred will come, and it will feel like an
improvement. It is the documented path to being in the third of feedback
interventions that make things worse. The impersonal register is not coldness.
It is the mechanism.

---

## 10. Notification volume and receptivity

**Supported.**

Habituation to repeated non-contingent stimuli is basic and well-established.
A notification that arrives regardless of state stops being processed.

Two design consequences already in the product:

- **One preempt per day, maximum.** A qualifying block already receives start,
  cutoff and end notifications. Without the cap, a bad week produces one nudge
  per block per day, which is how people disable notifications at the OS level
  and silently lose the entire accountability loop.
- **The cutoff nudge is silent** and fires only when the block has unfinished
  tasks and runs 30+ minutes. Contingency is what preserves signal value.

**Metric to watch in the beta:** notification-permission-revoked rate at day
14. If it is high, everything downstream of the loop is dead and no other
number matters.

---

## 11. What has no scientific basis

Being straight about it, so nobody later mistakes a choice for a finding.

- **The 100% accounted threshold for a streak day.** Arbitrary. Reasonable.
  Change it if cohort data says so.
- **Weekly insight cadence.** Convenient, not derived. Feedback-timing
  research does not clearly favour weekly.
- **Specific nudge copy.** Untested. Worth A/B testing once there is volume.
- **The 66-day habit figure**, if it ever appears in marketing. It is a median
  with an 18–254 day range. Quoting it as a rule would be a misrepresentation.
- **That insight changes behaviour at all.** The largest untested assumption in
  the product. §9 says a third of feedback interventions backfire. We have the
  attention-direction part right, which puts us on the better side of that
  distribution — but "correct feedback improves outcomes" is a hypothesis the
  beta tests, not a finding we inherit.

---

## 12. Muhasaba

The design's origin, and the closest existing description of what it is.

*Muhasaba* — daily self-accounting, reckoning one's own deeds without an
external judge — is a practice with substantial classical treatment, including
in Al-Ghazali and Ibn Qayyim.

The structural match is exact: nightly, honest, self-administered, no
audience, and the value residing in the accounting itself rather than in a
verdict. FlexMax is a muhasaba instrument with a pattern-detection layer.

This is not a marketing frame — it narrows the audience and the product's
public positioning is deliberately secular. It is recorded here because it is
the honest answer to why the design has the shape it does, and because several
decisions above (no audience, honesty over perfection, evidence over judgement)
follow from it more directly than from any paper cited in this document.

---

## Quick reference: what not to change without re-reading this

| Change that will look like an improvement | Section | Why not |
|---|---|---|
| Make insight copy more personal / motivational | §9 | Attention direction determines whether feedback helps or harms |
| Let tasks become the primary unit | §1, §2 | Removes the implementation-intention mechanism |
| Add a streak-preserving action that erases the miss | §4 | Converts compassion-with-standards into compassion-without |
| Fire the coupled preempt at the block's start | §7 | Correct message, useless moment; trains nudge-blindness |
| Explain the keystone finding as willpower depletion | §8 | Failed replication; use self-efficacy or state observation only |
| Raise notification frequency | §10 | Permission revocation kills the entire loop silently |
