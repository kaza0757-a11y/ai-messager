# BALE MESSAGER

A full-stack, real-time messaging web application built with Node.js, Express, Socket.io, SQLite, and Nodemailer.

## Features

- Email OTP registration flow
- Login with email and password
- Real-time chat using Socket.io
- SQLite storage for users, OTPs, and messages
- Dark/gold themed UI with contacts, typing indicators, and chat bubbles
- Welcome message seeded from BALE BOT after registration

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file:

```bash
copy .env.example .env
```

3. Edit `.env` and set your SMTP values and optional admin credentials:

```text
EMAIL_USER=your.email@example.com
EMAIL_PASS=your-email-app-password
PORT=3000
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-admin-password
ADMIN_USERNAME=BALE ADMIN
```

4. Start the server:

```bash
npm start
```

5. Open the app in your browser:

```text
http://localhost:3000
```

## File Structure

- `server.js` - Express server, API endpoints, Socket.io handlers
- `database.js` - SQLite database setup and helper functions
- `package.json` - Project metadata and dependencies
- `.env.example` - Environment variable template
- `public/index.html` - Client user interface
- `public/style.css` - UI styling
- `public/app.js` - Client-side application logic

## Notes

- Update `.env` with a valid SMTP account for OTP email delivery.
- The SQLite database file will be created automatically as `db.sqlite`.
- Do not commit `.env` or `db.sqlite` to source control.
