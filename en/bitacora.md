# Logbook

This is yours. It is what makes the course *your* course.

**What to write down:** the code you would have written before this course and the code you write now · the `curl` response you could not read · the thing you believed about HTTP that turned out to be different · the error from your own API that you recognized in one of the lessons.

**Why it matters:** in two weeks you will not remember what was hard for you. And what was hard for you is exactly what you need to review.

---

## Lesson 0 — The contract that travels over HTTP

_date:_

- Versions I got (`node -v`, `curl --version`):
- An API of mine or someone else's that returns `200` with the error in the body:
- What surprised me about the `curl -i` response:

## Lesson 1 — Successes and redirections

_date:_

- A `POST` of mine that should have returned `201` or `202` and what it returned:
- `301` or `308`? What happened to the `POST` body in each case:
- A `304` I saw and what it saved:

## Lesson 2 — The client made a mistake (I)

_date:_

- The difference between `401` and `403` in my own words:
- A resource where I chose `404` on purpose to hide it, and why:
- A `405` that was missing `Allow`:

## Lesson 3 — The client made a mistake (II)

_date:_

- The lost update: what happened before and after `If-Match`:
- My written policy for `400` versus `422`:
- A case where I hesitated between `409` and `412`:

## Lesson 4 — Server capacity and failures

_date:_

- An error from my server that said more than it should have:
- `500`, `502`, or `504`? The case that was hard for me to decide:
- What my client does when it receives `429` with `Retry-After`:

## Lesson 5 — Problem Details

_date:_

- The problem types (`type`) I defined for my API:
- A field I wanted to put in `title` that belonged in `detail`:
- What I left out of the body on purpose:

## Lesson 6 — Retries and idempotency

_date:_

- An operation of mine that cannot be repeated without duplicating:
- How many retries and with what delay I decided on, and why:

## Lesson 7 — Who reads the error

_date:_

- A code that my client treated the same as another and no longer does:
- What changes when the one reading the error is a program and not a person:

## Lesson 8 — The verifiable contract

_date:_

- How many of the 23 scenarios passed on the first try:
- The scenario that forced me to fix my API:
- What I still need before I can publish it:

---

## What I want to build next

_The list of things that occur to you as you go along. It is the best sign that the course worked._

-
