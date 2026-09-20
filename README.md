# ZMAIL Drop

Fixed Vercel-ready Maildrop viewer.

## GET request fix

Inbox and message requests use URL query parameters instead of request bodies:

- GET `/api/maildrop?action=inbox&mailbox=unknownmedev1`
- GET `/api/maildrop?action=message&mailbox=unknownmedev1&id=...`

Delete remains a POST mutation.

## Routes

- `/`
- `/login`
- `/inbox?mailbox=...`
- `/view?mailbox=...&id=...`

The application remains stateless for normal Maildrop operations.
