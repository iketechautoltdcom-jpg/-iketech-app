# IKETECH app - web screens (version 1)

## Put it online (free, about 10 minutes)
1. In Supabase open Project Settings > API. Copy the Project URL and the "anon public" key.
2. Open config.js in Notepad, replace the two PASTE lines with those values, save. (Never paste the "service_role" key anywhere.)
3. Go to app.netlify.com/drop (free account), drag the whole "web" folder onto the page. You get a link like https://xxxx.netlify.app.
4. Open the link, sign in with the email and password you made in Supabase.

## Customer tracking link
https://YOUR-LINK/track.html?t=TOKEN   (TOKEN is each inspection's tracking_token; the next version will create and send these automatically)

## In this version
Sign in, customers, vehicles, jobs (with confirmed-diagnosis rule), branches, team roles, tracking page.
Next: inspections screen, quotations/invoices/payments, messages, payroll.
