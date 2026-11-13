# Class Voice

A teacher-rating and voting app built with Next.js, JSX, Tailwind CSS, and the official MongoDB Node.js driver.

## Architecture

The browser is a client of Next.js route handlers. The route handlers are the security boundary: they authenticate signed, HttpOnly sessions, verify roles, validate vote contents, and persist all votes directly through the MongoDB Node.js driver. The UI never decides whether a vote is valid or whether a student has voted already.

### Database

- `students` stores each student's name, normalized unique name, MongoDB ObjectId, and creation time.
- `votes` stores one document per student, with all 12 subject ratings embedded in that document. A unique index on `studentId` and MongoDB's atomic document insert ensure only one vote can be stored for each student.
- The API validates the complete subject list and allowed 10–100% increments before inserting a vote.
- Required unique indexes are ensured when the backend connects and can also be created explicitly using `npm run db:setup`.

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
- `lib/auth.js`, `lib/mongodb.js`, `lib/subjects.js`: session, MongoDB connection/indexes, and validation helpers.

## Run locally

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env`. Set `DATABASE_URL` to your MongoDB connection string, plus a strong `ADMIN_PASSWORD` and random `SESSION_SECRET` (at least 32 characters). URL-encode any special characters in the database username or password.
3. Create the required unique indexes in MongoDB:

   ```powershell
   npm run db:setup
   ```

4. Start the app: `npm run dev`
5. Students can enter their names at `/` to sign in; no pre-registration is required. `/admin` can also be used to add names ahead of time or review student activity.

The admin password and session secret must be managed as deployment secrets in production. Never use the example values in a deployed environment. The local `.env` must also use a real MongoDB connection string; URLs beginning with `file:` are not supported.

## Deploy to Render

Create a Render **Web Service** from this repository and configure:

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm run start`

`npm run build` builds Next.js. `npm run start` binds Next.js to Render's interface. Run `npm run db:setup` once with Render's `DATABASE_URL` to create the required unique indexes. The backend also ensures these indexes when it first connects.

In Render's environment settings, configure:

- `DATABASE_URL` = your MongoDB Atlas connection string, including a database name
- `SESSION_SECRET` = a unique random value of at least 32 characters
- `ADMIN_PASSWORD` = the admin password you want to use on the deployed site

In MongoDB Atlas, allow connections from your Render service and ensure the database user has read/write permissions for the database. Do not upload `.env`; Render does not read your local environment file. Run `npm run db:setup` from an environment configured with Render's `DATABASE_URL` before accepting votes.

The previously displayed “Could not reach the server” text is from an older frontend version. Push the latest code and trigger a new Render deployment. If submissions still fail after redeploying, inspect Render's service logs for connection or authorization errors from MongoDB and the `/api/votes` route.
