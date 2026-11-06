# Newsroom Intelligence / Story Discovery Platform

A private newsroom workspace where approved journalists discover leads, claim reporting assignments, collect sources and evidence, write drafts, and work with editors through publication. It prevents duplicated reporting and keeps a story's evidence separate from the credentials of its reporter.

**A verified journalist does not make a verified story.** Leads contain claims, not automatically established facts. Gemini offers clearly labeled reporting suggestions; humans make editorial decisions.

## Quick start

Requirements: Node.js 22.12+ (Node 24 recommended), npm, and MongoDB Community Server or MongoDB Atlas. Run commands from this project folder:

```sh
cd "newsroom intelligence/story discovery platform"
npm install
cp server/.env.example server/.env
```

Edit `server/.env`. Generate a JWT secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and paste the result into `JWT_SECRET`. Never commit this file.

### Start MongoDB

Install MongoDB Community Server using the official instructions for your operating system: https://www.mongodb.com/docs/manual/installation/

For an isolated local database (keep this terminal open):

```sh
mkdir -p work/mongodb
mongod --dbpath ./work/mongodb --bind_ip 127.0.0.1 --port 27028
```

Set `MONGODB_URI=mongodb://127.0.0.1:27028/newsroom_intelligence` in `server/.env`. Alternatively, use your existing local MongoDB on port 27017, or an Atlas connection string. For Atlas, create a database user and allow your development IP. Do not put the connection string in the client.

```sh
npm run seed
npm run dev
```

Open **http://localhost:5173** (use `localhost` consistently, matching CLIENT_URL). The API runs on http://localhost:4000. Vite proxies `/api` and `/socket.io` to Express. The seed is additive: it preserves existing accounts and stories.

In this delivered workspace, dependencies are installed and a local `server/.env` was generated with a random secret and MongoDB port **27028**. The API, Vite preview, and isolated MongoDB were started for validation. These processes are temporary; use the commands above after restarting your environment.

### Separate terminals

```sh
npm run dev -w server
npm run dev -w client
```

Restart the backend after backend changes. Optional automatic reload: `npm run dev:watch -w server`. The ordinary dev command avoids operating-system file-watcher limits.

### Production build

```sh
npm run build
npm start
```

Express serves `client/dist` with SPA fallback. For a local production-build preview, set `CLIENT_URL=http://localhost:4000`. For deployment, set `NODE_ENV=production`, use an HTTPS reverse proxy, and set CLIENT_URL to the actual frontend origin. Secure cookies require HTTPS in production. The server binds to loopback for local/reverse-proxy use. This project has not been deployed publicly.

## Environment variables

All secrets belong in **server/.env**. There are no client secrets.

| Variable              | Purpose                                                         |
| --------------------- | --------------------------------------------------------------- |
| MONGODB_URI           | MongoDB connection string, required                             |
| JWT_SECRET            | Random signing secret of at least 32 characters, required       |
| CLIENT_URL            | Exact allowed browser origin, defaults to http://localhost:5173 |
| PORT                  | API port, defaults to 4000; update Vite proxy if changing it    |
| NODE_ENV              | development locally; production behind HTTPS                    |
| GEMINI_API_KEY        | Gemini API key, needed only for AI assistance                   |
| GEMINI_MODEL          | Available Gemini model name, defaults to gemini-3.5-flash-lite       |
| CLOUDINARY_CLOUD_NAME | Cloudinary cloud name                                           |
| CLOUDINARY_API_KEY    | Cloudinary API key                                              |
| CLOUDINARY_API_SECRET | Cloudinary API secret                                           |

Gemini: create a key in Google AI Studio and select a model available to your account. Requests use the documented generateContent API: https://ai.google.dev/api/generate-content . Story title, description, draft, source records and explicitly pasted text are sent only when the user clicks Generate suggestions. No automatic URL fetching or document parsing is performed. Paste extracted document text to summarize it.

Cloudinary: configure the three values from your Cloudinary console. Server-side upload_stream stores files remotely and only saves metadata in MongoDB: https://cloudinary.com/documentation/node_image_and_video_upload . Supported uploads: PNG, JPEG, PDF, MP4, up to 20 MB. File signatures are checked. PDF delivery may require enabling PDF delivery in Cloudinary settings. This MVP uses standard Cloudinary delivery URLs; anyone possessing a URL may access that asset. Do not upload confidential source material until authenticated/private delivery and malware scanning are implemented.

Missing integration credentials return clear 503 messages; no fake AI response or fake upload is substituted. The core reporting workflow works without those external services, but successful remote uploads and live AI generation require them.

## Fictional demo accounts

All demo accounts use password **NewsroomDemo123!**. Never seed these accounts into production; the seed script refuses NODE_ENV=production.

| Role                | Email                     |
| ------------------- | ------------------------- |
| Organization admin  | admin@newsroom.test       |
| Editor              | editor@newsroom.test      |
| Verified journalist | journalist@newsroom.test  |
| Verified journalist | journalist2@newsroom.test |
| Verified journalist | journalist3@newsroom.test |

Organization: **The Daily Ledger**. All people, reporting tips and stories are fictional. Admins and editors are provisioned by the seed; public registration always creates a pending journalist, ignoring client-supplied roles.

## Walk through the application

1. Register a journalist with the demo organization. The profile shows pending approval; story access is blocked.
2. Sign in as admin, review the member's professional information, and approve their account. Rejected users can request another review. Suspension blocks authentication.
3. Sign in again as the approved journalist, create a lead, optionally attach an initial source and then a lead image.
4. Sign in as another journalist. Search/filter the discovery board, open the lead, and select Investigate story. The status becomes CLAIMED. Only one concurrent claim can succeed.
5. Select Start investigation. Add sources, notes and evidence files. Sources and evidence remain available to organization colleagues and editors.
6. Write a headline, body, summary and attributed facts. Save the draft, then save and submit for review. Draft editing is locked during review.
7. Sign in as editor. Open the review queue, inspect sources/evidence/notes, and use the Story draft tab to approve, request changes with feedback, or reject.
8. After changes are requested, the assigned journalist can revise and resubmit. After approval, the editor can mark the story published.
9. Publication is an internal lifecycle status; it does not publish to a public CMS.

## Architecture

```text
React + React Router + Tailwind
           | Axios HTTP requests (HttpOnly session cookie)
           v
Express REST API + authorization + Zod validation
           | Mongoose
           v
MongoDB: organizations, users, stories, sources,
         evidence, investigations, editor reviews

Express -> Cloudinary: file bytes; MongoDB keeps URL and metadata
Express -> Gemini: explicitly requested reporting assistance
Socket.IO -> organization room: story claim/status notifications
```

React renders the interface and calls the backend. Express validates input, verifies the JWT, loads the current user from MongoDB and checks their role, verification, organization and assignment before changing records. Mongoose defines the database collections and references. The frontend never decides permissions.

JWTs last eight hours and live in HttpOnly, SameSite cookies. Logout invalidates sessions using a database token version; verification changes and suspension also invalidate sessions. Passwords use bcrypt. Mutations reject unexpected browser origins. Login/registration, general API traffic and AI requests have rate limits. Errors do not expose database or provider internals. All story reads and mutations are scoped to the user's organization. Socket connections authenticate the same cookie, join only their organization, and periodically recheck access. Existing sockets are disconnected on logout or administrative changes.

Status transitions and claims use conditional MongoDB updates. A claim succeeds only while the record is NEW_LEAD. Draft/source/evidence changes are limited to the assigned reporter while reporting is open. Editor actions are conditional on the current state. Related collection writes are deliberately simple rather than transaction-based; see future improvements for stronger crash consistency.

## Complete source folder structure

Generated dependencies, build output, and runtime database contents are omitted below.

```text
newsroom intelligence/
└── story discovery platform/
    ├── .gitignore
    ├── package.json
    ├── package-lock.json
    ├── README.md
    ├── client/
    │   ├── package.json
    │   ├── index.html
    │   ├── vite.config.js
    │   └── src/
    │       ├── App.jsx
    │       ├── main.jsx
    │       ├── styles.css
    │       ├── components/
    │       │   ├── Layout.jsx
    │       │   └── UI.jsx
    │       ├── context/Auth.jsx
    │       ├── services/api.js
    │       └── pages/
    │           ├── Auth.jsx
    │           ├── Stories.jsx
    │           ├── Story.jsx
    │           └── Administration.jsx
    ├── server/
    │   ├── package.json
    │   ├── .env.example
    │   ├── .env                 (local, ignored)
    │   ├── src/
    │   │   ├── app.js
    │   │   ├── server.js
    │   │   ├── seed.js
    │   │   ├── models/index.js
    │   │   ├── middleware/auth.js
    │   │   ├── routes/api.js
    │   │   └── services/integrations.js
    │   └── test/workflow.test.js
    └── work/                   (ignored local runtime/test assets)
```

Models are grouped in one short file to keep navigation simple; the seven models remain separate MongoDB collections. Routes similarly share small authorization and transition helpers rather than introducing additional architectural layers.

## Main API routes

All routes except registration, login and organization names require a session. Journalists must be verified for story access.

| Method / route                               | Purpose / permissions                                |
| -------------------------------------------- | ---------------------------------------------------- |
| GET /api/organizations                       | Organization names for registration                  |
| POST /api/auth/register                      | Register a pending journalist                        |
| POST /api/auth/login                         | Authenticate; set session cookie                     |
| GET /api/auth/me                             | Current profile                                      |
| POST /api/auth/logout                        | Invalidate sessions; clear cookie                    |
| POST /api/users/verification-request         | Journalist resubmission                              |
| GET /api/users                               | Admin's organization members                         |
| PATCH /api/users/:id                         | Admin verifies/rejects/suspends/restores journalists |
| GET /api/stories                             | Search/filter list, organization scoped              |
| POST /api/stories                            | Verified journalist creates lead                     |
| GET /api/stories/:id                         | Story, sources, evidence, investigation and reviews  |
| POST /api/stories/:id/claim                  | Atomic journalist claim                              |
| POST /api/stories/:id/start                  | Assigned journalist starts reporting                 |
| POST /api/stories/:id/image                  | Author uploads optional image on new lead            |
| POST /api/stories/:id/sources                | Assigned journalist adds source                      |
| POST /api/stories/:id/evidence               | Assigned journalist uploads file                     |
| POST /api/stories/:id/notes                  | Assigned journalist adds investigation note          |
| PUT /api/stories/:id/draft                   | Assigned journalist saves draft                      |
| POST /api/stories/:id/submit-review          | Assigned journalist submits saved draft              |
| GET /api/editor/reviews                      | Editor's review/investigation queue                  |
| POST /api/editor/reviews/:id/approve         | Editor approves reviewed story                       |
| POST /api/editor/reviews/:id/request-changes | Editor requests revisions with feedback              |
| POST /api/editor/reviews/:id/reject          | Editor rejects with feedback                         |
| POST /api/editor/reviews/:id/publish         | Editor publishes approved story                      |
| POST /api/ai/story-brief                     | Generate structured investigation brief              |
| POST /api/ai/investigation-questions         | Generate interview/investigation questions           |
| POST /api/ai/summarize                       | Summarize supplied text and source notes             |
| POST /api/ai/extract-facts                   | Extract attributed claims, not truth judgments       |

List query parameters: `search`, `category`, `location` (exact match), `priority`, `status`, `sort=newest|priority`, `mine=true`. Lists are capped at 200 for this MVP. AI bodies include `storyId` and optional `text`. Upload bodies are multipart with `file` and (for evidence) `title`. Other mutations use JSON. Review `:id` identifies the story. Successful creations return 201; invalid input 400; unauthenticated requests 401; unauthorized 403; missing records 404; conflicting transitions 409; oversized uploads 413; unconfigured integrations 503.

## Tests and verification

```sh
# Keep the isolated MongoDB on port 27028 running:
npm test
# Or use another MongoDB instance:
TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm test
npm run build
```

Tests create a uniquely named `newsroom_test_<timestamp>` database, then delete only that test database. They exercise real Express requests and MongoDB writes, including registration, server-side role protection, pending/rejected verification, reapproval, cross-organization isolation, competing claims, ownership, sources, notes, drafts, revision requests, approval, publication, rejection, logout, suspension, URL validation and CSRF origin checks. File validation and missing-provider configuration are covered; successful Cloudinary/Gemini calls are not mocked as successful. Both integration tests and the production frontend build passed during implementation. Live Socket.IO checks also confirmed authenticated connection and rejection of an unauthenticated connection.

Browser-driven visual inspection could not run because the in-app browser returned a session ownership error. The local preview remains available for manual inspection. Run the walkthrough above to inspect the UI and test provider integrations once credentials are added.

## Implemented features

- Real React/Express/MongoDB workflow; no frontend-only story data.
- Journalist, editor, organization admin roles; pending/verified/rejected accounts.
- Professional responsive UI, dashboard counts, discovery cards, search and filters.
- Atomic claim, explicit investigation start, assignment and status history.
- Source records, evidence uploads, optional lead image, investigation notes.
- Draft editing, submission, feedback, revision cycles, approval/rejection/publication.
- Gemini assistance with clear attribution and uncertainty labels.
- Organization-scoped real-time claim/status notifications.
- Account suspension, session invalidation, validation, error handling and rate limits.
- Fictional demo data, environment template and real database integration tests.

## Intentionally left for future development

- Email verification, password reset, MFA, invitation-based organization onboarding.
- Public CMS publishing, collaborative rich-text editing, autosave and draft version history.
- Private/signed evidence delivery, malware scanning, stronger source confidentiality controls.
- File text extraction/OCR, large/video chunked uploads, citation-aware document search.
- Pagination beyond 200 stories, organization creation UI, richer member administration.
- MongoDB transactions/outbox for atomic multi-collection writes (review audit + status, claim + investigation), orphan upload cleanup, backups, monitoring and deployment automation.
- More granular evidence assessment by human reviewers; AI will never be a truth authority.

Manual setup still required: your Cloudinary credentials, Gemini key/model, and production database/HTTPS configuration if deploying. No GitHub repository or public deployment was created because no destination was supplied. All project files, local caches, and test runtime data are contained in the requested parent folder.
