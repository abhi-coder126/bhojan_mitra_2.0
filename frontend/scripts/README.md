# UI audit

Start the frontend with `npm run dev`, then run `npm run test:ui` in another terminal.
The audit uses Playwright with installed Google Chrome. Set `UI_AUDIT_ORIGIN` if Vite is running somewhere other than `http://localhost:5173`.

All backend requests are mocked. No live orders, payments, or records are changed.

Checks include 22 routes at desktop and mobile widths, horizontal overflow, clipped buttons, runtime errors, duplicate submissions, API failure/retry handling, delete-dialog behavior, and New Order controls at 1440px, 390px, and 320px.

These checks exercise fixture data; they do not replace live backend/payment integration testing.
