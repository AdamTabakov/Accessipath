# AGENTS.md

## Project Overview

AccessiPath is an accessibility-first navigation web application designed to help people find routes that are more suitable for users with mobility and accessibility needs.

The application uses OpenStreetMap-based geographic data to provide navigation and route information while considering accessibility-related factors such as:

* Stairs
* Steep paths
* Sidewalks
* Crossings
* Entrances
* Surface types
* Barriers
* Accessibility tags
* Route confidence

The goal is **not simply to find the shortest route**.

The goal is to find a **usable route**.

A route that is technically valid but contains stairs for a wheelchair user is not considered a good route.

---

# Core Principles

When making changes to AccessiPath, prioritize:

1. Accessibility
2. Security
3. Correctness
4. Reliability
5. Performance
6. Maintainability
7. Visual polish

Never sacrifice accessibility, security, or route correctness merely to make the UI prettier or the implementation shorter.

---

# Technology Stack

## Frontend

Use:

* React
* TypeScript
* Vite
* Tailwind CSS
* shadcn/ui where appropriate
* React Router
* OpenStreetMap-based mapping
* PostgreSQL

Prefer reusable React components over large monolithic components.

Use TypeScript types rather than `any`.

---

## Backend

The backend is responsible for functionality that should not be exposed directly to the browser, including:

* API integrations requiring secrets
* Route processing
* Accessibility scoring
* External service requests
* Server-side validation
* Application business logic
* Authentication and authorization

Never expose API keys or private credentials in frontend code.

---

## Deployment

The application should be deployable using Render.

The application should work correctly in:

* Local development
* Production

Do not introduce infrastructure requiring a completely different deployment platform unless explicitly requested.

---

# OpenStreetMap

AccessiPath uses OpenStreetMap as a major geographic data source.

When working with OSM data:

* Respect OSM attribution requirements.
* Do not assume every accessibility feature is mapped.
* Treat missing accessibility information as **unknown**.
* Never fabricate accessibility information.
* Distinguish between:

  * `accessible`
  * `inaccessible`
  * `unknown`

For example:

```ts
type AccessibilityStatus =
  | "accessible"
  | "inaccessible"
  | "unknown";
```

Never interpret:

```text
No stairs data
```

as:

```text
There are no stairs
```

Those are fundamentally different.

External geographic data must also be treated as untrusted input.

---

# Routing Philosophy

AccessiPath should optimize for accessibility rather than blindly optimizing for distance.

A route may be longer but preferable if it avoids:

* Stairs
* Steep slopes
* Inaccessible crossings
* Difficult terrain
* Known barriers
* Inaccessible entrances

Example:

```text
Route A
Distance: 600m
Stairs: 2
Slope: steep

Route B
Distance: 850m
Stairs: 0
Slope: moderate
```

For an accessibility-focused user, Route B may be significantly better.

The routing system should support accessibility-aware scoring.

---

# Accessibility Scoring

Route scoring should consider multiple factors.

Potential factors include:

* Distance
* Estimated travel time
* Stairs
* Slope
* Surface type
* Sidewalk availability
* Crossing information
* Accessibility tags
* Known barriers
* Route confidence
* Unknown/missing data

Conceptually:

```text
route score =
    distance cost
  + stairs penalty
  + slope penalty
  + surface penalty
  + barrier penalty
  + uncertainty penalty
```

Weights should be configurable rather than hardcoded throughout the application.

Do not assume that every user has identical accessibility requirements.

---

# Unknown Data

Accessibility data is often incomplete.

This is one of the most important concepts in AccessiPath.

Never do:

```ts
if (!hasStairs) {
  accessible = true;
}
```

Instead, distinguish:

```ts
hasStairs === false
```

from:

```ts
hasStairs === undefined
```

The first means stairs are known to be absent.

The second means the information is unknown.

Users should be able to understand when route information is uncertain.

---

# User Experience

Users should quickly understand:

* Where they are
* Where they are going
* Which route is recommended
* Why the route was recommended
* What accessibility obstacles exist
* How confident the application is in its accessibility information

Avoid hiding important accessibility information behind multiple menus.

The UI should feel modern, clean, trustworthy, and easy to understand.

---

# UI Design

Prefer:

* Clear typography
* Strong visual hierarchy
* Generous spacing
* Subtle borders
* Restrained use of color
* Accessible contrast
* Clear status indicators
* Responsive layouts

Avoid:

* Excessive gradients
* Unnecessary animations
* Cluttered dashboards
* Tiny buttons
* Low-contrast text
* Accessibility information represented only through color

Do not rely exclusively on color to communicate:

```text
Accessible
Inaccessible
Unknown
```

Always provide another visual indicator.

---

# Accessibility Requirements

AccessiPath itself must be accessible.

Follow WCAG principles wherever practical.

Ensure:

* Keyboard navigation works.
* Interactive elements are focusable.
* Focus states are visible.
* Buttons have accessible names.
* Form inputs have labels.
* Images have appropriate alt text.
* Color contrast is sufficient.
* Important information is not conveyed through color alone.
* Modals/dialogs are keyboard accessible.
* Screen-reader users can understand route information.
* Semantic HTML is used.

Prefer:

```html
<button>
```

over:

```html
<div onClick={...}>
```

for interactive controls.

---

# Map

The map is a core part of AccessiPath.

Users should be able to:

* Search for locations
* Select a starting point
* Select a destination
* View routes
* Compare routes
* Understand accessibility issues along routes

Map interactions should remain responsive.

Do not perform expensive route calculations on every tiny map movement.

Debounce expensive operations when appropriate.

---

# Component Architecture

Prefer small components with clear responsibilities.

Recommended structure:

```text
src/
├── components/
│   ├── map/
│   ├── routing/
│   ├── accessibility/
│   ├── navigation/
│   └── ui/
├── pages/
├── hooks/
├── services/
├── types/
├── utils/
└── data/
```

Do not create huge components containing:

* API calls
* Routing logic
* Map rendering
* Accessibility scoring
* UI state
* Form handling

Separate these responsibilities.

---

# API Calls

Keep external API calls inside dedicated service modules.

Prefer:

```ts
services/
├── routing.ts
├── geocoding.ts
└── osm.ts
```

Then:

```ts
const route = await getAccessibleRoute(origin, destination);
```

instead of making raw requests throughout React components.

---

# Error Handling

Never silently ignore errors.

Bad:

```ts
try {
  ...
} catch {
}
```

Prefer:

```ts
try {
  ...
} catch (error) {
  console.error("Failed to calculate route:", error);
  setError("Unable to calculate a route.");
}
```

User-facing errors should be understandable.

Never expose:

* Stack traces
* API keys
* Database errors
* Internal paths
* Sensitive information

to users.

---

# Loading States

Potentially slow operations should have appropriate loading states.

Examples:

* Location search
* Route calculation
* Map loading
* Accessibility data loading

Avoid making the interface appear frozen.

---

# TypeScript Rules

Use strict TypeScript whenever possible.

Avoid:

```ts
any
```

unless there is a legitimate reason.

Prefer:

```ts
unknown
```

when receiving data of unknown shape and validate it afterward.

Use explicit types for:

* API responses
* Route objects
* Accessibility information
* Coordinates
* Map features
* User preferences

---

# Geographic Data

Use explicit geographic types.

For example:

```ts
type Coordinates = {
  latitude: number;
  longitude: number;
};
```

Be careful about coordinate order.

Many geographic libraries use:

```text
[longitude, latitude]
```

while other APIs use:

```text
latitude, longitude
```

Never assume coordinate order without checking the API/library documentation.

Always validate coordinates:

```text
latitude: -90 to 90
longitude: -180 to 180
```

---

# Security

Security is a first-class requirement.

Agents must proactively identify and prevent vulnerabilities rather than only fixing them when explicitly requested.

Consider:

* Authentication
* Authorization
* Input validation
* API security
* Secrets management
* Dependency vulnerabilities
* XSS
* CSRF
* SSRF
* CORS
* Rate limiting
* Abuse prevention
* Data exposure
* Error handling
* File uploads
* URL handling
* Location data
* Client-side trust
* Server-side validation

---

# Never Trust the Client

Anything sent by the browser is untrusted.

Never rely exclusively on frontend validation for:

* Authentication
* Authorization
* Permissions
* Coordinates
* User preferences
* Accessibility settings
* API parameters
* Resource IDs
* File types
* File sizes
* Administrative actions

Security-sensitive validation must happen on the server.

Frontend checks are for UX, not security.

---

# Input Validation

Validate all external input.

This includes:

* JSON bodies
* Query parameters
* URL parameters
* Form submissions
* Relevant headers
* Coordinates
* Search queries
* User-generated text
* Uploaded files
* Webhook payloads

Prefer schema validation using Zod or another established validation library when appropriate.

Never blindly trust:

```ts
req.body
req.query
req.params
```

---

# Injection Prevention

Protect against:

* SQL injection
* NoSQL injection
* Command injection
* Template injection
* Header injection
* Path traversal

Never construct queries or shell commands by concatenating untrusted input.

Prefer parameterized queries and safe APIs.

Never do:

```ts
exec(`command ${userInput}`);
```

with unvalidated user input.

---

# XSS Prevention

Never inject untrusted HTML.

Avoid:

```tsx
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

unless HTML is intentionally supported and properly sanitized.

Treat user-generated content as plain text by default.

Be particularly careful with:

* Search results
* Location names
* User descriptions
* OSM data
* URL parameters
* Error messages

---

# CSRF

If authentication uses cookies, protect state-changing requests against CSRF.

Consider:

* SameSite cookies
* CSRF tokens
* Origin validation
* Referer validation where appropriate

CORS is **not** a CSRF defense.

---

# Authentication

Use established authentication systems.

Never:

* Store plaintext passwords.
* Log passwords.
* Return passwords in API responses.
* Hardcode authentication secrets.
* Trust a frontend-supplied user ID as proof of identity.

If implementing passwords, use a modern password hashing algorithm such as:

* Argon2id
* bcrypt

Never invent custom cryptography.

---

# Authorization

Authentication answers:

> Who are you?

Authorization answers:

> Are you allowed to do this?

Protected resources must verify authorization server-side.

Prevent:

* IDOR
* BOLA
* Privilege escalation
* Horizontal privilege escalation
* Vertical privilege escalation

Never assume that requesting:

```text
/api/users/123
```

means the user is allowed to access user `123`.

Verify ownership or permissions.

---

# Session Security

When using sessions or tokens:

* Use reasonable expiration times.
* Rotate sensitive credentials where appropriate.
* Invalidate sessions when necessary.
* Use secure cookie settings.
* Avoid unnecessarily exposing tokens.
* Never log authentication tokens.

Authentication cookies should generally use:

```text
Secure
HttpOnly
SameSite
```

where appropriate.

---

# Secrets Management

Never commit secrets.

Potential secrets include:

* API keys
* JWT secrets
* Database passwords
* OAuth secrets
* Private keys
* Service credentials
* Access tokens

Check:

```text
.env
.env.*
source code
configuration files
CI/CD configuration
logs
```

Never expose secrets through frontend JavaScript.

Anything shipped to the browser is public.

---

# API Security

Every backend endpoint should be evaluated for:

* Authentication
* Authorization
* Input validation
* Rate limiting
* Abuse potential
* Data exposure
* Error handling
* Request size
* Response size

Return only necessary fields.

Prefer:

```ts
return {
  id: user.id,
  name: user.name,
};
```

instead of returning entire internal database objects.

---

# Rate Limiting

Consider rate limiting for:

* Login
* Registration
* Password reset
* Search
* Geocoding
* Routing
* AI/API requests
* File uploads
* Expensive operations

Protect external API quotas.

Users should not be able to make unlimited expensive requests.

---

# CORS

Do not blindly use:

```ts
cors()
```

for production authenticated APIs.

Avoid:

```text
Access-Control-Allow-Origin: *
```

when credentials or protected resources are involved.

Allow only trusted origins when appropriate.

Development origins can be explicitly supported.

---

# HTTP Security Headers

Where appropriate, configure:

* Content-Security-Policy
* X-Content-Type-Options
* Referrer-Policy
* Strict-Transport-Security
* Permissions-Policy
* Frame-ancestors

Do not blindly copy a security configuration without verifying its effect on the application.

---

# Content Security Policy

If practical, implement a restrictive CSP.

Avoid unnecessarily broad policies such as:

```text
script-src *
```

or:

```text
default-src *
```

Only allow required origins.

Third-party scripts must be evaluated before being added.

---

# SSRF

If the backend accepts URLs, protect against SSRF.

Do not allow arbitrary server-side requests to:

```text
localhost
127.0.0.1
0.0.0.0
::1
private IP ranges
cloud metadata endpoints
internal services
```

If URL fetching is required, use an allowlist of permitted domains whenever possible.

---

# File Uploads

If uploads are introduced, validate:

* File size
* MIME type
* Extension
* File contents
* Filename
* Number of files

Never trust the client-provided MIME type.

Prevent:

* Executable uploads
* Path traversal
* Malicious filenames
* Oversized files
* ZIP bombs
* Content-type confusion

Store uploaded files outside executable directories where possible.

---

# Geographic Privacy

AccessiPath may handle sensitive location information.

Minimize collection and retention.

Do not store precise location history unless explicitly required.

If location data is stored:

* Document why.
* Minimize retention.
* Restrict access.
* Avoid exposing it through public APIs.
* Do not unnecessarily log coordinates.

Never log precise user locations unless genuinely required for debugging.

---

# Logging

Never log:

* Passwords
* API keys
* Authentication tokens
* Session cookies
* Sensitive personal information
* Unnecessary precise location data

Logs should help diagnose issues without becoming a source of data leakage.

---

# Production Errors

Never return:

```ts
{
  error: error.stack
}
```

to users.

Instead:

```ts
{
  error: "An unexpected error occurred."
}
```

Detailed errors may be logged securely on the server.

---

# Dependency Security

Before adding dependencies:

1. Verify necessity.
2. Check maintenance status.
3. Check known vulnerabilities.
4. Avoid abandoned packages.
5. Avoid unnecessary transitive dependencies.

Regularly run:

```bash
npm audit
```

Do not blindly run:

```bash
npm audit fix --force
```

because it may introduce breaking changes.

---

# Security Tooling

Use appropriate security tooling when available.

Potential tools include:

* ESLint security rules
* Semgrep
* GitHub Dependabot
* GitHub CodeQL
* Trivy
* Secret scanners

Do not add security tooling purely for the sake of adding tools.

Use tools that provide meaningful coverage.

---

# Database Security

If a database is introduced:

* Use parameterized queries.
* Validate input.
* Use least-privilege credentials.
* Restrict database network access where possible.
* Never expose the database directly to the browser.
* Use appropriate indexes.
* Implement authorization at the data-access layer.
* Avoid returning unnecessary records.

Database credentials must remain server-side.

---

# External APIs

For OpenStreetMap, routing providers, geocoding providers, AI APIs, and other services:

* Protect credentials.
* Validate responses.
* Handle failures.
* Implement timeouts.
* Avoid unlimited retries.
* Respect rate limits.
* Cache where appropriate.
* Treat external responses as untrusted input.

Never assume third-party data is correct or safe.

---

# Environment Separation

Keep development and production environments separate.

Never use production credentials locally unless explicitly required.

Never hardcode:

```text
production database URLs
production API keys
production secrets
```

into source code.

---

# Git Security

Never commit:

```text
.env
.env.local
private keys
credentials
API tokens
```

Before committing, check for accidental secrets.

Do not rewrite Git history unless explicitly requested.

Do not force push unless explicitly requested.

Use focused commits such as:

```text
feat: add accessible route scoring
fix: handle missing OSM accessibility data
feat: add route comparison panel
fix: validate route coordinates
security: restrict API CORS origins
```

---

# Testing

Before considering a feature complete:

* Run TypeScript checks.
* Run linting.
* Run tests.
* Build the application.
* Test relevant UI manually.
* Test security-sensitive functionality.

At minimum, use the project's configured commands and:

```bash
npm run build
```

where applicable.

Never claim tests passed if they were not actually run.

---

# Security Check

Before completing a significant feature, perform a security review.

Check:

```text
[ ] No secrets were added
[ ] No API keys are exposed to the frontend
[ ] User input is validated
[ ] Server-side validation exists where required
[ ] Authentication is enforced where required
[ ] Authorization is enforced server-side
[ ] No obvious IDOR/BOLA vulnerability exists
[ ] No SQL/NoSQL injection exists
[ ] No command injection exists
[ ] No unsafe HTML injection exists
[ ] URLs are validated where applicable
[ ] SSRF is considered where applicable
[ ] CORS is appropriately configured
[ ] CSRF is considered where cookies are used
[ ] Rate limiting is considered for public/expensive endpoints
[ ] Sensitive information is not logged
[ ] Production errors do not expose internals
[ ] Security headers are considered
[ ] Dependencies do not contain critical vulnerabilities
[ ] File uploads are securely validated if applicable
[ ] Location data is minimized and protected
[ ] External API responses are validated
[ ] TypeScript checks pass
[ ] Linting passes
[ ] Tests pass
[ ] Production build passes
```

---

# Performance

Avoid unnecessary:

* React re-renders
* API calls
* Map updates
* Route calculations
* Large data transformations

Use memoization only when there is a measurable or reasonable benefit.

For large geographic datasets, consider:

* Spatial filtering
* Caching
* Lazy loading
* Server-side processing
* Pagination
* Data simplification

Do not prematurely optimize simple code.

---

# AI Agent Rules

When modifying the repository:

1. Inspect existing code before changing it.
2. Understand the existing architecture.
3. Reuse existing components and services where appropriate.
4. Make the smallest change that solves the problem.
5. Do not rewrite working code unnecessarily.
6. Do not introduce new frameworks without explicit approval.
7. Do not modify unrelated files.
8. Preserve existing functionality.
9. Verify changes after implementation.
10. Never fabricate API responses.
11. Never fabricate accessibility information.
12. Never knowingly introduce a security vulnerability.

If requirements are ambiguous, choose the smallest reasonable implementation that preserves the architecture.

---

# Before Editing

Before making substantial changes:

```text
1. Inspect relevant files.
2. Understand current data flow.
3. Identify reusable components.
4. Identify API/service abstractions.
5. Identify security implications.
6. Identify accessibility implications.
7. Make the smallest appropriate change.
```

Do not immediately rewrite files.

---

# Before Finishing

After implementing a feature:

```text
1. Check TypeScript errors.
2. Run linting.
3. Run tests.
4. Build the project.
5. Verify affected functionality.
6. Check responsive behavior.
7. Check keyboard accessibility.
8. Perform a security review.
9. Check for exposed secrets.
10. Check changed dependencies.
11. Verify no unrelated files were modified.
12. Summarize important changes.
```

---

# What Agents Must NOT Do

Never:

* Delete working features without permission.
* Replace the routing system without permission.
* Replace OpenStreetMap without permission.
* Fabricate accessibility information.
* Hardcode API keys.
* Commit `.env` files containing secrets.
* Introduce unnecessary dependencies.
* Rewrite the entire project for a minor feature.
* Remove accessibility features to simplify implementation.
* Claim tests passed when they were not run.
* Hide errors from users.
* Use inaccessible UI patterns.
* Treat missing OSM information as proof of accessibility.
* Trust frontend validation as a security mechanism.
* Expose sensitive information in API responses.
* Log secrets or authentication credentials.
* Disable security protections simply to make development easier.
* Ignore a discovered serious vulnerability.

---

# Threat Modeling

For significant features, consider:

## Assets

What are we protecting?

Examples:

* User accounts
* Authentication credentials
* API keys
* Location information
* Application data
* External API quotas

## Attackers

Potential attackers include:

* Anonymous internet users
* Malicious authenticated users
* Automated bots
* Compromised accounts
* Malicious API clients

## Attack Surface

Potential attack surfaces include:

* Frontend
* REST APIs
* Authentication endpoints
* Search endpoints
* Routing endpoints
* External API integrations
* File uploads
* Webhooks
* User-generated content

For significant features, identify realistic abuse cases before shipping.

---

# Definition of Done

A feature is complete when:

* It solves the requested problem.
* Existing functionality still works.
* TypeScript passes.
* Linting passes.
* Tests pass.
* The production build succeeds.
* Errors are handled appropriately.
* The UI is responsive.
* Keyboard accessibility has been considered.
* Security has been reviewed.
* No secrets were exposed.
* Accessibility data was not fabricated.
* External data was validated.
* The implementation follows the existing architecture.
* No unnecessary dependencies were introduced.

---

# Product Direction

AccessiPath should feel like:

> **Google Maps, but designed around accessibility rather than treating accessibility as an afterthought.**

The application should help users answer:

> **"Can I actually use this route?"**

rather than simply:

> **"What is the shortest route?"**

Accessibility information should be:

* Actionable
* Understandable
* Transparent
* Trustworthy

---

# Security Principle

The default assumption should always be:

> **Anything outside the trusted server boundary can be malicious.**

The frontend is not a security boundary.

The browser is not trusted.

User input is not trusted.

External APIs are not trusted.

OpenStreetMap data is not trusted.

Never rely on obscurity or client-side checks for security.
