# Legal CRM SaaS Backend

Production-ready multi-tenant Legal CRM backend built with NestJS, TypeScript, TypeORM, MySQL/PostgreSQL, JWT, RBAC, Multer, and Nodemailer.

## Features

- **Multi-tenant architecture** with firm isolation
- **Three user types**: Law Firm, Individual Lawyer, Client
- **Role-based access control** (RBAC): SUPER_ADMIN, FIRM_ADMIN, LAWYER, INDIVIDUAL, CLIENT
- **JWT authentication** with bcrypt password hashing
- **Invite system** for lawyers and clients with email integration
- **File uploads** using Multer (documents, firm logos)
- **Email service** with Nodemailer (invites, password reset, notifications)

## Tech Stack

- NestJS 10
- TypeScript
- TypeORM (MySQL / PostgreSQL)
- Passport JWT
- class-validator / class-transformer
- Multer
- Nodemailer
- bcrypt
- uuid

## Project Structure

```
src/
├── auth/           # JWT auth, signup flows
├── users/          # User profile
├── firms/          # Firm CRUD, logo upload
├── firm-users/     # Firm member management, invites
├── clients/        # Client CRUD
├── matters/        # Case/matter CRUD
├── daily-listings/ # Daily listing / daily cases (court diary rows per matter)
├── documents/      # Document upload/download
├── invoices/       # Invoice management
├── invites/        # Invite creation, acceptance
├── notifications/  # User notifications
├── email/          # Email service (Nodemailer)
├── common/         # Guards, decorators, interceptors
├── config/         # Configuration
└── database/       # TypeORM entities
```

## Setup

### Prerequisites

- Node.js 18+
- MySQL 8+ or PostgreSQL 14+

### Installation

```bash
npm install
cp .env.example .env
# Edit .env with your database, JWT secret, and SMTP settings
```

### Database

Create the database:

```sql
CREATE DATABASE legal_crm;
```

With `synchronize: true` in development, TypeORM will create tables automatically. For production, use migrations.

### Running

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

Server runs at `http://localhost:3000` (or `PORT` from .env).

## API Endpoints

### Auth (Public)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login with email/password |
| POST | `/auth/signup/firm` | Signup as law firm |
| POST | `/auth/signup/individual` | Signup as individual lawyer |
| POST | `/auth/signup/client` | Signup as client (requires invite token) |
| POST | `/auth/forgot-password` | Request password reset email |
| POST | `/auth/reset-password` | Reset password with token |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/me` | Get current user profile |

### Firms

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/firms` | Create firm (INDIVIDUAL only) |
| GET | `/firms` | List firms |
| GET | `/firms/:id` | Get firm |
| PATCH | `/firms/:id` | Update firm |
| PATCH | `/firms/:id/logo` | Upload firm logo (multipart) |

### Firm Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/firms/:firmId/users` | List firm users |
| POST | `/firms/:firmId/users/invite` | Invite lawyer/admin |
| DELETE | `/firms/:firmId/users/:userId` | Remove user from firm |

### Clients

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/clients` | Create client |
| GET | `/clients` | List clients |
| GET | `/clients/:id` | Get client |
| PATCH | `/clients/:id` | Update client |
| DELETE | `/clients/:id` | Delete client |

### Matters

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/matters` | Create matter |
| GET | `/matters` | List matters (filter: firmId, clientId) |
| GET | `/matters/:id` | Get matter |
| PATCH | `/matters/:id` | Update matter |
| DELETE | `/matters/:id` | Delete matter |

### Daily listings (daily cases)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/daily-listings` | Create daily listing row |
| GET | `/daily-listings/matter/:matterId` | List daily listings by matter |
| GET | `/daily-listings/:id` | Get daily listing |
| PATCH | `/daily-listings/:id` | Update daily listing |
| DELETE | `/daily-listings/:id` | Delete daily listing |

### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/documents/matter/:matterId/upload` | Upload document (multipart, field: `file`) |
| GET | `/documents/matter/:matterId` | List documents for matter |
| GET | `/documents/:id` | Get document metadata |
| GET | `/documents/:id/download` | Download document |
| DELETE | `/documents/:id` | Delete document |

### Invoices

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/invoices` | Create invoice |
| GET | `/invoices/matter/:matterId` | List invoices for matter |
| GET | `/invoices/:id` | Get invoice |
| PATCH | `/invoices/:id` | Update invoice |
| DELETE | `/invoices/:id` | Delete invoice |

### Invites

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/invites/token?token=` | Get invite by token (public) |
| POST | `/invites/client` | Create client invite |
| POST | `/invites/accept` | Accept firm user invite (public) |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | List user notifications |
| GET | `/notifications/:id` | Get notification |
| PATCH | `/notifications/:id/read` | Mark as read |
| PATCH | `/notifications/read-all` | Mark all as read |

## Authentication

Include the JWT in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

## Signup Flows

### 1. Signup as Firm

```json
POST /auth/signup/firm
{
  "firmName": "ABC Law Firm",
  "subdomain": "abc-law",
  "adminName": "John Doe",
  "adminEmail": "admin@abclaw.com",
  "adminPassword": "secret123"
}
```

Creates the firm and firm admin. Admin can invite lawyers via `/firms/:firmId/users/invite`.

### 2. Signup as Individual Lawyer

```json
POST /auth/signup/individual
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "password": "secret123"
}
```

Creates an individual lawyer with their own workspace. They manage their own clients and matters.

### 3. Signup as Client

Client signs up via invite link. First, create a client and send an invite:

```
POST /clients { "name": "Client Name", "email": "client@example.com" }
POST /invites/client { "email": "client@example.com", "firmId": "...", "clientId": "..." }
```

Then client visits the invite link and registers:

```json
POST /auth/signup/client
{
  "name": "Client Name",
  "email": "client@example.com",
  "password": "secret123",
  "inviteToken": "<token_from_invite>"
}
```

## Environment Variables

See `.env.example` for all options. Key variables:

- `DB_TYPE`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`
- `UPLOAD_PATH`, `MAX_FILE_SIZE`

## License

MIT
