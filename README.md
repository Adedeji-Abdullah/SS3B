# Class Voice

A teacher-rating and voting application built with Next.js, JSX, Tailwind CSS, Express, and MongoDB.

## Architecture

- `server.js` hosts Next.js and the Express backend.
- `app/page.jsx` provides student name sign-in.
- `app/vote/page.jsx` handles rating selection, review, and one-time submission.
- `app/admin/page.jsx` provides administrator results, visualizations, and roster management.
- `lib/subjects.js` contains the shared subject list, rating values, and student-name normalization.

MongoDB stores student records in `students` and one vote document per student in `votes`. A unique index on normalized student names prevents duplicate student records, while a unique index on vote `studentId` is the authoritative duplicate-submission guard. The server validates the complete set of subjects and rating values before writing a vote.

Student sign-in asks only for a name, as requested. This does not prove a student's real-world identity: another person can sign in using that student's name. Use individual student credentials or invitation codes if identity verification is required.

## Configuration

Set these environment variables for local development and deployment:

- `MONGODB_URI`: MongoDB connection string including a database name. `DATABASE_URL` is accepted as an alias.
- `SESSION_SECRET`: random secret of at least 32 characters used to sign session cookies.
- `ADMIN_PASSWORD`: administrator password.
- `PORT`: optional; defaults to `3000`.

Copy `.env.example` to `.env` for local development and replace each placeholder. Never commit `.env` or use example values in production. In MongoDB Atlas, allow network access from the deployment service and grant the database user read/write permissions.

## Run locally

1. Install packages: `npm install`
2. Configure `.env`.
3. Start Next.js and Express together: `npm run dev`
4. Open the URL printed by the server.

Use `/` for student sign-in and `/admin` for the administrator dashboard.

## API routes

| Route | Access | Purpose |
|---|---|---|
| `POST /api/auth/student` | Public | Find or create a student by normalized name and sign in |
| `POST /api/auth/admin` | Public | Sign in with `ADMIN_PASSWORD` |
| `GET /api/auth/me` | Signed-in user | Return current user and, for students, vote status |
| `POST /api/auth/logout` | Public | Clear the signed session cookie |
| `POST /api/votes` | Student | Validate and submit one rating per subject |
| `GET /api/admin/results` | Admin | Aggregate totals, averages, distributions, and rankings |
| `GET /api/admin/students` | Admin | List students and submission status |
| `POST /api/admin/students` | Admin | Add a student to the roster |

## Deploy

For a Render Web Service, use:

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm run start`

Configure `MONGODB_URI`, `SESSION_SECRET`, and `ADMIN_PASSWORD` in the service's environment settings. Do not upload `.env`; deployment providers use their own environment variables.
