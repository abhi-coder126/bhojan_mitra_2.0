// One-time helper: gets a Gmail API refresh token for utils/mailer.js.
//
//   1. Put GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET (a "Desktop app" OAuth client) in .env
//   2. npm run gmail:token
//   3. Open the printed link, sign in with the EMAIL_USER Gmail account, click Allow
//   4. Copy the printed GMAIL_REFRESH_TOKEN into .env (and Render's environment)
require("dotenv").config({ quiet: true });
const http = require("http");

const PORT = 5055;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/oauth2callback`;
const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET } = process.env;

if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
  console.error("Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in backend/.env first.");
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: GMAIL_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.send",
    access_type: "offline",
    prompt: "consent",
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== "/oauth2callback") return res.end();

  const code = url.searchParams.get("code");
  if (!code) {
    res.end(`Authorization failed: ${url.searchParams.get("error") || "no code"}`);
    return server.close();
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const body = await tokenRes.json();

  if (!body.refresh_token) {
    res.end("No refresh token returned -- check the terminal.");
    console.error("Token exchange failed:", body);
  } else {
    res.end("Done! Go back to the terminal and copy the refresh token.");
    console.log("\nAdd this to backend/.env and to Render's Environment:\n");
    console.log(`GMAIL_REFRESH_TOKEN=${body.refresh_token}\n`);
  }
  server.close();
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("\nOpen this link in your browser and sign in with", process.env.EMAIL_USER || "your Gmail account", ":\n");
  console.log(authUrl, "\n");
});
