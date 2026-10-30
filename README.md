# MediReminder — A Smart Medicine Reminder and Medication Management Platform

MediReminder is a beginner-friendly full-stack web application built with HTML, CSS, JavaScript, Node.js and Express. It lets users create an account, manage medicine details and reminder times, record doses as taken or missed, and view dose history.

## Features
- User registration and login (passwords are hashed with bcrypt)
- JWT-based API authentication
- Add, edit and delete medicines
- Dosage, reminder time, instructions and optional refill date
- Taken/missed dose logging and history
- Browser notification reminders while the app is open and permission is granted
- Responsive dashboard
- JSON-file persistence for a quick college demonstration

## Requirements
- Node.js 18 or later
- npm
- A modern browser

## Run locally
1. Install Node.js LTS from https://nodejs.org/
2. Extract the project ZIP and open the `MediReminder` folder in VS Code.
3. Open Terminal → New Terminal.
4. Run:

   ```bash
   npm install
   npm start
   ```

5. Open http://localhost:3000
6. Create an account, then add a medicine with its prescribed dosage and a reminder time.

The server creates `data.json` on first run. This file contains account records, medicines and dose logs. It is excluded from Git by `.gitignore`.

## Test checklist
- Register an account with a valid email and password of at least 8 characters.
- Log out and log back in.
- Add a medicine and check that it appears on the dashboard and My medicines.
- Edit the medicine and confirm the changes.
- Record a dose as Taken, then view Dose history.
- Record a dose as Missed and verify the history status.
- Delete a medicine.
- Refresh the browser and verify the data remains.

## Important limitations
- This college demo uses a JSON file rather than a production database such as PostgreSQL or MongoDB.
- Browser notifications require permission and this page to remain open; they are not guaranteed when the browser is closed or the computer is asleep.
- The default JWT secret is for local demonstration only. Before deployment, set a strong `JWT_SECRET` environment variable.
- Do not use real patient or sensitive medical information in a public demo.
- This application records user-entered information. It does not diagnose, prescribe, or recommend medicines. Users should follow their clinician's instructions.

## Suggested future improvements
- Replace JSON storage with PostgreSQL or MongoDB
- Add email/push notifications with a background scheduler
- Add password reset, rate limiting, audit logging and automated tests
- Add deployment configuration and CI using GitHub Actions

## GitHub upload
Create a new empty repository on GitHub, then run these commands in the project folder (replace `YOUR-USERNAME` and `YOUR-REPOSITORY`):

```bash
git init
git add .
git commit -m "Initial MediReminder implementation"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```



