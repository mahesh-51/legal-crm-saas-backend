# Legal CRM API – cURL Requests

Base URL: `http://localhost:3000`

Save the `accessToken` from login/signup responses and use it as: `Authorization: Bearer <accessToken>`

---

## Auth (Public – No Token Required)

### Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "secret123"
  }'
```

### Signup as Firm

```bash
curl -X POST http://localhost:3000/auth/signup/firm \
  -H "Content-Type: application/json" \
  -d '{
    "firmName": "ABC Law Firm",
    "subdomain": "abc-law",
    "adminName": "John Doe",
    "adminEmail": "admin@abclaw.com",
    "adminPassword": "secret123"
  }'
```

### Signup as Individual Lawyer

```bash
curl -X POST http://localhost:3000/auth/signup/individual \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "email": "jane@example.com",
    "password": "secret123"
  }'
```

### Signup as Client (requires invite token)

```bash
curl -X POST http://localhost:3000/auth/signup/client \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Client Name",
    "email": "client@example.com",
    "password": "secret123",
    "inviteToken": "<token_from_invite_email>"
  }'
```

### Forgot Password

```bash
curl -X POST http://localhost:3000/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

### Reset Password

```bash
curl -X POST http://localhost:3000/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "<reset_token_from_email>",
    "newPassword": "newsecret123"
  }'
```

---

## Users (Auth Required)

### Get Current User Profile

```bash
curl -X GET http://localhost:3000/users/me \
  -H "Authorization: Bearer <accessToken>"
```

---

## Firms (Auth Required)

### Create Firm (INDIVIDUAL role only)

```bash
curl -X POST http://localhost:3000/firms \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Law Firm",
    "subdomain": "my-law-firm"
  }'
```

### List Firms

```bash
curl -X GET http://localhost:3000/firms \
  -H "Authorization: Bearer <accessToken>"
```

### Get Firm by ID

```bash
curl -X GET http://localhost:3000/firms/<firmId> \
  -H "Authorization: Bearer <accessToken>"
```

### Update Firm

```bash
curl -X PATCH http://localhost:3000/firms/<firmId> \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Firm Name",
    "subdomain": "updated-subdomain"
  }'
```

### Upload Firm Logo (multipart)

```bash
curl -X PATCH http://localhost:3000/firms/<firmId>/logo \
  -H "Authorization: Bearer <accessToken>" \
  -F "logo=@/path/to/logo.png"
```

---

## Firm Users (Auth Required – FIRM_ADMIN)

### List Firm Users

```bash
curl -X GET http://localhost:3000/firms/<firmId>/users \
  -H "Authorization: Bearer <accessToken>"
```

### Invite Lawyer/Admin

```bash
curl -X POST http://localhost:3000/firms/<firmId>/users/invite \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lawyer@example.com",
    "role": "LAWYER"
  }'
```

<!-- role: "FIRM_ADMIN" or "LAWYER" -->

### Remove User from Firm

```bash
curl -X DELETE http://localhost:3000/firms/<firmId>/users/<userId> \
  -H "Authorization: Bearer <accessToken>"
```

---

## Clients (Auth Required)

### Create Client

```bash
curl -X POST "http://localhost:3000/clients?firmId=<firmId>" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Client",
    "phone": "+1234567890",
    "email": "client@example.com"
  }'
```

### List Clients

```bash
curl -X GET "http://localhost:3000/clients?firmId=<firmId>" \
  -H "Authorization: Bearer <accessToken>"
```

### Get Client by ID

```bash
curl -X GET http://localhost:3000/clients/<clientId> \
  -H "Authorization: Bearer <accessToken>"
```

### Update Client

```bash
curl -X PATCH http://localhost:3000/clients/<clientId> \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Client Name",
    "phone": "+0987654321",
    "portalAccess": true
  }'
```

### Delete Client

```bash
curl -X DELETE http://localhost:3000/clients/<clientId> \
  -H "Authorization: Bearer <accessToken>"
```

---

## Matters (Auth Required)

### Create Matter

```bash
curl -X POST "http://localhost:3000/matters?firmId=<firmId>" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "caseTitle": "Smith v. Jones",
    "court": "Supreme Court",
    "caseType": "Civil",
    "status": "OPEN",
    "cnr": "CNR123",
    "clientId": "<clientId>",
    "firmId": "<firmId>"
  }'
```

<!-- status: OPEN, ACTIVE, ON_HOLD, CLOSED -->

### List Matters

```bash
curl -X GET "http://localhost:3000/matters?firmId=<firmId>&clientId=<clientId>" \
  -H "Authorization: Bearer <accessToken>"
```

### Get Matter by ID

```bash
curl -X GET http://localhost:3000/matters/<matterId> \
  -H "Authorization: Bearer <accessToken>"
```

### Update Matter

```bash
curl -X PATCH http://localhost:3000/matters/<matterId> \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "caseTitle": "Updated Case Title",
    "status": "ACTIVE"
  }'
```

### Delete Matter

```bash
curl -X DELETE http://localhost:3000/matters/<matterId> \
  -H "Authorization: Bearer <accessToken>"
```

---

## Daily listings (Auth Required)

### Create daily listing

`clientIds` must include the matter’s primary client; you may add more clients.

```bash
curl -X POST http://localhost:3000/daily-listings \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "matterId": "<matterId>",
    "clientIds": ["<clientId>"],
    "caseType": "Civil",
    "caseNo": "123/2025",
    "complainants": ["A. Plaintiff"],
    "defendants": ["B. Defendant"],
    "status": "SCHEDULED",
    "currentDate": "2025-04-15",
    "nextDate": "2025-05-01",
    "synopsis": "Arguments",
    "orders": "Next date fixed"
  }'
```

### List daily listings by matter

```bash
curl -X GET http://localhost:3000/daily-listings/matter/<matterId> \
  -H "Authorization: Bearer <accessToken>"
```

### Get daily listing by ID

```bash
curl -X GET http://localhost:3000/daily-listings/<dailyListingId> \
  -H "Authorization: Bearer <accessToken>"
```

### Update daily listing

```bash
curl -X PATCH http://localhost:3000/daily-listings/<dailyListingId> \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "currentDate": "2025-04-20",
    "nextDate": "2025-06-01",
    "status": "ADJOURNED",
    "synopsis": "Updated synopsis",
    "orders": "Updated orders"
  }'
```

### Delete daily listing

```bash
curl -X DELETE http://localhost:3000/daily-listings/<dailyListingId> \
  -H "Authorization: Bearer <accessToken>"
```

---

## Documents (Auth Required)

### Upload Document (multipart)

```bash
curl -X POST http://localhost:3000/documents/matter/<matterId>/upload \
  -H "Authorization: Bearer <accessToken>" \
  -F "file=@/path/to/document.pdf"
```

### List Documents by Matter

```bash
curl -X GET http://localhost:3000/documents/matter/<matterId> \
  -H "Authorization: Bearer <accessToken>"
```

### Get Document Metadata

```bash
curl -X GET http://localhost:3000/documents/<documentId> \
  -H "Authorization: Bearer <accessToken>"
```

### Download Document

```bash
curl -X GET http://localhost:3000/documents/<documentId>/download \
  -H "Authorization: Bearer <accessToken>" \
  -o document.pdf
```

### Delete Document

```bash
curl -X DELETE http://localhost:3000/documents/<documentId> \
  -H "Authorization: Bearer <accessToken>"
```

---

## Invoices (Auth Required)

### Create Invoice

```bash
curl -X POST http://localhost:3000/invoices \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "matterId": "<matterId>",
    "amount": 5000.00,
    "status": "DRAFT",
    "paymentReference": "REF-001"
  }'
```

<!-- status: DRAFT, SENT, PAID, OVERDUE, CANCELLED -->

### List Invoices by Matter

```bash
curl -X GET http://localhost:3000/invoices/matter/<matterId> \
  -H "Authorization: Bearer <accessToken>"
```

### Get Invoice by ID

```bash
curl -X GET http://localhost:3000/invoices/<invoiceId> \
  -H "Authorization: Bearer <accessToken>"
```

### Update Invoice

```bash
curl -X PATCH http://localhost:3000/invoices/<invoiceId> \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5500.00,
    "status": "PAID",
    "paymentReference": "PAY-001"
  }'
```

### Delete Invoice

```bash
curl -X DELETE http://localhost:3000/invoices/<invoiceId> \
  -H "Authorization: Bearer <accessToken>"
```

---

## Invites

### Get Invite by Token (Public)

```bash
curl -X GET "http://localhost:3000/invites/token?token=<invite_token>" \
  -H "Content-Type: application/json"
```

### Create Client Invite (Auth Required)

```bash
curl -X POST http://localhost:3000/invites/client \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "client@example.com",
    "role": "CLIENT",
    "firmId": "<firmId>",
    "clientId": "<clientId>"
  }'
```

### Accept Firm User Invite (Public)

```bash
curl -X POST http://localhost:3000/invites/accept \
  -H "Content-Type: application/json" \
  -d '{
    "token": "<invite_token>",
    "name": "Jane Lawyer",
    "password": "secret123"
  }'
```

---

## Notifications (Auth Required)

### List Notifications

```bash
curl -X GET http://localhost:3000/notifications \
  -H "Authorization: Bearer <accessToken>"
```

### Get Notification by ID

```bash
curl -X GET http://localhost:3000/notifications/<notificationId> \
  -H "Authorization: Bearer <accessToken>"
```

### Mark Notification as Read

```bash
curl -X PATCH http://localhost:3000/notifications/<notificationId>/read \
  -H "Authorization: Bearer <accessToken>"
```

### Mark All Notifications as Read

```bash
curl -X PATCH http://localhost:3000/notifications/read-all \
  -H "Authorization: Bearer <accessToken>"
```

---

## Dashboard (Auth Required)

Firm-scoped overview: `firmId` query required for firm users and super admins (same as clients/matters). Omit `firmId` only for individual lawyers without a firm.

### Overview (KPIs, activity, tasks, meetings, reminders)

```bash
curl -X GET "http://localhost:3000/dashboard/overview?firmId=<firmId>" \
  -H "Authorization: Bearer <accessToken>"
```

Response includes `kpis.pendingTasks`, `kpis.upcomingMeetingsNextDays`, `upcomingTasks`, `upcomingMeetings`, `upcomingReminders`, and extended `recentActivity` types (`task.created`, `meeting.created`).

---

## Tasks (Auth Required)

Each task must reference at least one of `matterId`, `clientId`, or `dailyListingId` (daily listing implies a matter). Use query `firmId` for firm users / super admin on write and list.

### Create Task

```bash
curl -X POST "http://localhost:3000/tasks?firmId=<firmId>" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "matterId": "<matterId>",
    "title": "File written statement",
    "description": "Optional",
    "kind": "task",
    "status": "pending",
    "dueAt": "2025-04-01T10:00:00.000Z",
    "reminderAt": "2025-03-31T09:00:00.000Z"
  }'
```

`kind`: `task` | `follow_up`. `status`: `pending` | `in_progress` | `done` | `cancelled`.

### List Tasks

```bash
curl -X GET "http://localhost:3000/tasks?firmId=<firmId>&matterId=<matterId>&status=pending" \
  -H "Authorization: Bearer <accessToken>"
```

### Get / Update / Delete Task

```bash
curl -X GET "http://localhost:3000/tasks/<taskId>" \
  -H "Authorization: Bearer <accessToken>"

curl -X PATCH "http://localhost:3000/tasks/<taskId>" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{ "status": "done" }'

curl -X DELETE "http://localhost:3000/tasks/<taskId>" \
  -H "Authorization: Bearer <accessToken>"
```

---

## Meetings (Auth Required)

Same linking rules as tasks (`matterId`, `clientId`, or `dailyListingId`). `startAt` is required.

### Create Meeting

Paste a **Google Meet**, **Microsoft Teams**, or **Zoom** join URL in `meetingUrl`, set `meetingLinkProvider` so the UI can show the right icon, and use `shareLinkWithClient` (default `true`) to control whether **client** API responses include the join link.

```bash
curl -X POST "http://localhost:3000/meetings?firmId=<firmId>" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "<clientId>",
    "title": "Client consultation",
    "startAt": "2025-04-02T14:00:00.000Z",
    "endAt": "2025-04-02T15:00:00.000Z",
    "location": "Video call",
    "meetingUrl": "https://teams.microsoft.com/l/meetup-join/...",
    "meetingLinkProvider": "microsoft_teams",
    "shareLinkWithClient": true,
    "reminderAt": "2025-04-02T13:00:00.000Z"
  }'
```

`meetingLinkProvider`: `google_meet` | `microsoft_teams` | `zoom` | `other`.

### List Meetings

```bash
curl -X GET "http://localhost:3000/meetings?firmId=<firmId>&status=scheduled" \
  -H "Authorization: Bearer <accessToken>"
```

### Get / Update / Delete Meeting

```bash
curl -X GET "http://localhost:3000/meetings/<meetingId>" \
  -H "Authorization: Bearer <accessToken>"

curl -X PATCH "http://localhost:3000/meetings/<meetingId>" \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{ "status": "completed" }'

curl -X DELETE "http://localhost:3000/meetings/<meetingId>" \
  -H "Authorization: Bearer <accessToken>"
```

---

## Quick Reference

| Category      | Public Endpoints                                                                 |
|---------------|-----------------------------------------------------------------------------------|
| Auth          | `POST /auth/login`, `POST /auth/signup/*`, `POST /auth/forgot-password`, `POST /auth/reset-password` |
| Invites       | `GET /invites/token`, `POST /invites/accept`                                      |

| Category      | Protected Endpoints (Bearer token required)                                      |
|---------------|-----------------------------------------------------------------------------------|
| Users         | `GET /users/me`                                                                  |
| Firms         | `POST /firms`, `GET /firms`, `GET /firms/:id`, `PATCH /firms/:id`, `PATCH /firms/:id/logo` |
| Firm Users    | `GET /firms/:firmId/users`, `POST /firms/:firmId/users/invite`, `DELETE /firms/:firmId/users/:userId` |
| Clients       | `POST /clients`, `GET /clients`, `GET /clients/:id`, `PATCH /clients/:id`, `DELETE /clients/:id` |
| Matters       | `POST /matters`, `GET /matters`, `GET /matters/:id`, `PATCH /matters/:id`, `DELETE /matters/:id` |
| Daily listings | `POST /daily-listings`, `GET /daily-listings/matter/:matterId`, `GET/PATCH/DELETE /daily-listings/:id` |
| Documents     | `POST /documents/matter/:matterId/upload`, `GET /documents/matter/:matterId`, `GET /documents/:id`, `GET /documents/:id/download`, `DELETE /documents/:id` |
| Invoices      | `POST /invoices`, `GET /invoices/matter/:matterId`, `GET/PATCH/DELETE /invoices/:id` |
| Invites       | `POST /invites/client`                                                            |
| Notifications | `GET /notifications`, `GET /notifications/:id`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` |
| Dashboard     | `GET /dashboard/overview`                                                         |
| Tasks         | `POST /tasks`, `GET /tasks`, `GET/PATCH/DELETE /tasks/:id`                        |
| Meetings      | `POST /meetings`, `GET /meetings`, `GET/PATCH/DELETE /meetings/:id`               |
