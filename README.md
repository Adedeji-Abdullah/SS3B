# Class Voice

A teacher-rating and voting app built with Next.js, JSX, Tailwind CSS, Prisma, and MongoDB.

## Architecture

The browser is a client of Next.js route handlers. The route handlers are the security boundary: they authenticate signed, HttpOnly sessions, verify roles, validate vote contents, and persist all votes through Prisma. The UI never decides whether a vote is valid or whether a student has voted already.

### Database

- `Student` stores the student's name and its normalized, unique lookup name. Any name entered on the sign-in page is created automatically; the admin does not need to pre-register students.
- `Vote` belongs to one `Student`. A unique `studentId` ensures each normalized name has at most one vote.
- `Rating` belongs to one `Vote` and stores a subject and percentage. A unique `(voteId, subject)` pair prevents duplicate subject ratings in a vote.
- The API validates the subject list and allowed 10–100% increments. It creates the vote and all 12 ratings in one nested database operation.
- MongoDB stores each model in its own collection. The schema uses ObjectId identifiers and Prisma relations; unique indexes enforce one student account per normalized name and one vote per student.
- Vote submission creates the vote and its 12 ratings as a nested write. MongoDB must run as a replica set (MongoDB Atlas does) because Prisma uses transactions for nested writes.

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
2. Copy `.env.example` to `.env`. Set `DATABASE_URL` to your MongoDB connection string, plus a strong `ADMIN_PASSWORD` and random `SESSION_SECRET` (at least 32 characters). URL-encode any special characters in the database username or password.
3. Generate the Prisma client and synchronize the schema/indexes to MongoDB:

   ```powershell
   npm run db:generate
   npm run db:push
   ```

4. Start the app: `npm run dev`
5. Students can enter their names at `/` to sign in; no pre-registration is required. `/admin` can also be used to add names ahead of time or review student activity.

The admin password and session secret must be managed as deployment secrets in production. Never use the example values in a deployed environment. The local `.env` must also use a real MongoDB connection string; URLs beginning with `file:` are not supported.

## Deploy to Render

Create a Render **Web Service** from this repository and configure:

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm run start`

`npm run build` generates the Prisma client. `npm run start` binds Next.js to Render's interface. Use `npm run db:push` once against the configured MongoDB database to create collections and unique indexes.

In Render's environment settings, configure:

- `DATABASE_URL` = your MongoDB Atlas connection string, including a database name
- `SESSION_SECRET` = a unique random value of at least 32 characters
- `ADMIN_PASSWORD` = the admin password you want to use on the deployed site

In MongoDB Atlas, allow connections from your Render service and ensure the database user has read/write permissions for the database. Do not upload `.env`; Render does not read your local environment file. Run `npm run db:push` from an environment configured with Render's `DATABASE_URL` before accepting votes. This database provider uses `prisma db push` rather than Prisma Migrate.

The previously displayed “Could not reach the server” text is from an older frontend version. Push the latest code and trigger a new Render deployment. If submissions still fail after redeploying, inspect Render's service logs for connection or authorization errors from MongoDB and the `/api/votes` route.
