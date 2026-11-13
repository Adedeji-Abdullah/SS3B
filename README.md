# Class Voice

A teacher-rating and voting app built with Next.js, JSX, Tailwind CSS, Prisma, and SQLite.

## Architecture

The browser is a client of Next.js route handlers. The route handlers are the security boundary: they authenticate signed, HttpOnly sessions, verify roles, validate vote contents, and persist all votes through Prisma. The UI never decides whether a vote is valid or whether a student has voted already.

### Database

- `Student` stores the student's name and its normalized, unique lookup name. Any name entered on the sign-in page is created automatically; the admin does not need to pre-register students.
- `Vote` belongs to one `Student`. A unique `studentId` ensures each normalized name has at most one vote.
- `Rating` belongs to one `Vote` and stores a subject and percentage. A unique `(voteId, subject)` pair prevents duplicate subject ratings in a vote.
- The API validates the subject list and allowed 10–100% increments. It creates the vote and all 12 ratings in one nested database operation.
- SQLite is the local development database. For multi-instance production hosting, use PostgreSQL and set `DATABASE_URL` to the managed database connection string.

### Authentication and authorization

- Students enter any name. The server normalizes it, finds or creates a student record, and issues a signed, HttpOnly, SameSite=Strict cookie.
- Admins sign in with `ADMIN_PASSWORD`, configured outside source control. Admin APIs check the signed session role on every request.
- Student vote submission takes its student ID only from the verified session cookie, never from the request body.
- Name-only student sign-in does not verify a student's real-world identity. It prevents duplicate database submissions for the same normalized name, but cannot prevent impersonation or a person entering a different name. Use individual credentials or one-time invitation codes if identity verification is required.

### API routes

| Route | Access | Purpose |
|---|---|---|
| `POST /api/auth/student` | Public | Create/find a student by name and sign in |
| `POST /api/auth/admin` | Public | Sign in with the configured admin password |
| `GET /api/auth/me` | Signed-in user | Return the current session and vote status |
| `POST /api/auth/logout` | Public | Clear the session cookie |
| `POST /api/votes` | Student | Validate and persist the student's one-time 12-subject vote |
| `GET /api/admin/results` | Admin | Aggregate totals, averages, distributions, and rankings from database rows |
| `GET /api/admin/students` | Admin | List roster entries and submission status |
| `POST /api/admin/students` | Admin | Add a student to the eligible roster |

### Frontend structure

- `app/page.jsx`: student name sign-in and admin sign-in link.
- `app/vote/page.jsx`: subject ratings, review-before-submit, and confirmation.
- `app/admin/page.jsx`: results, rating visualizations, rankings, and roster management.
- `app/api/**/route.js`: server-side API handlers.
- `lib/auth.js`, `lib/prisma.js`, `lib/subjects.js`: session, persistence, and validation helpers.

## Run locally

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and set a strong `ADMIN_PASSWORD` and random `SESSION_SECRET` (at least 32 characters).
3. Generate the Prisma client and create the local database:

   ```powershell
   npm run db:generate
   npm run db:migrate -- --name init
   ```

4. Start the app: `npm run dev`
5. Students can enter their names at `/` to sign in; no pre-registration is required. `/admin` can also be used to add names ahead of time or review student activity.

The admin password and session secret must be managed as deployment secrets in production. Never use the example values in a deployed environment.

## Deploy to Render

Create a Render **Web Service** from this repository and configure:

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm run start`

`npm run build` generates the Prisma client. At startup, `npm run start` applies checked-in database migrations and binds Next.js to Render's interface.

This project currently uses SQLite. In Render's **Disks** settings, attach a persistent disk mounted at `/var/data`, then set these environment variables in the service dashboard:

- `DATABASE_URL` = `file:/var/data/class-voice.db`
- `SESSION_SECRET` = a unique random value of at least 32 characters
- `ADMIN_PASSWORD` = the admin password you want to use on the deployed site

Do not upload `.env`; Render does not read your local environment file. Without a persistent disk, SQLite data may be lost when Render replaces the service instance. If your Render plan does not support persistent disks, switch the Prisma datasource to PostgreSQL and use a Render PostgreSQL database before accepting real votes.

The previously displayed “Could not reach the server” text is from an older frontend version. Push the latest code and trigger a new Render deployment. If submissions still fail after redeploying, inspect the service logs for errors from `prisma migrate deploy` or the `/api/votes` route.
