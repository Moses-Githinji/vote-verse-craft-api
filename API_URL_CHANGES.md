# API URL Changes - Backend v2.0

## Overview
The API endpoints have been updated to remove the organization type (`:orgType`) from the URL path. The organization is now determined from the user's JWT token instead of the URL.

## Affected Organization Types
- school
- sacco
- church
- political

## URL Changes by Endpoint

### 1. Elections

| Org Type | Old URL | New URL |
|----------|---------|---------|
| school | `GET /api/v1/school/elections` | `GET /api/v1/elections` |
| church | `GET /api/v1/church/elections` | `GET /api/v1/elections` |
| sacco | `GET /api/v1/sacco/elections` | `GET /api/v1/elections` |
| political | `GET /api/v1/political/elections` | `GET /api/v1/elections` |

| Org Type | Old URL | New URL |
|----------|---------|---------|
| school | `GET /api/v1/school/elections/:id` | `GET /api/v1/elections/:id` |
| church | `GET /api/v1/church/elections/:id` | `GET /api/v1/elections/:id` |
| sacco | `GET /api/v1/sacco/elections/:id` | `GET /api/v1/elections/:id` |
| political | `GET /api/v1/political/elections/:id` | `GET /api/v1/elections/:id` |

| Org Type | Old URL | New URL |
|----------|---------|---------|
| school | `POST /api/v1/school/elections` | `POST /api/v1/elections` |
| church | `POST /api/v1/church/elections` | `POST /api/v1/elections` |
| sacco | `POST /api/v1/sacco/elections` | `POST /api/v1/elections` |
| political | `POST /api/v1/political/elections` | `POST /api/v1/elections` |

| Org Type | Old URL | New URL |
|----------|---------|---------|
| school | `PUT /api/v1/school/elections/:id` | `PUT /api/v1/elections/:id` |
| church | `PUT /api/v1/church/elections/:id` | `PUT /api/v1/elections/:id` |
| sacco | `PUT /api/v1/sacco/elections/:id` | `PUT /api/v1/elections/:id` |
| political | `PUT /api/v1/political/elections/:id` | `PUT /api/v1/elections/:id` |

### 2. Voters

| Org Type | Old URL | New URL |
|----------|---------|---------|
| school | `GET /api/v1/school/voters` | `GET /api/v1/voters` |
| church | `GET /api/v1/church/voters` | `GET /api/v1/voters` |
| sacco | `GET /api/v1/sacco/voters` | `GET /api/v1/voters` |
| political | `GET /api/v1/political/voters` | `GET /api/v1/voters` |

| Org Type | Old URL | New URL |
|----------|---------|---------|
| school | `POST /api/v1/school/voters` | `POST /api/v1/voters` |
| church | `POST /api/v1/church/voters` | `POST /api/v1/voters` |
| sacco | `POST /api/v1/sacco/voters` | `POST /api/v1/voters` |
| political | `POST /api/v1/political/voters` | `POST /api/v1/voters` |

| Org Type | Old URL | New URL |
|----------|---------|---------|
| school | `POST /api/v1/school/voters/bulk` | `POST /api/v1/voters/bulk` |
| church | `POST /api/v1/church/voters/bulk` | `POST /api/v1/voters/bulk` |
| sacco | `POST /api/v1/sacco/voters/bulk` | `POST /api/v1/voters/bulk` |
| political | `POST /api/v1/political/voters/bulk` | `POST /api/v1/voters/bulk` |

### 3. Voting

| Org Type | Old URL | New URL |
|----------|---------|---------|
| school | `POST /api/v1/school/vote` | `POST /api/v1/vote` |
| church | `POST /api/v1/church/vote` | `POST /api/v1/vote` |
| sacco | `POST /api/v1/sacco/vote` | `POST /api/v1/vote` |
| political | `POST /api/v1/political/vote` | `POST /api/v1/vote` |

### 4. Candidates

| Org Type | Old URL | New URL |
|----------|---------|---------|
| school | `GET /api/v1/school/elections/:electionId/candidates` | `GET /api/v1/elections/:electionId/candidates` |
| church | `GET /api/v1/church/elections/:electionId/candidates` | `GET /api/v1/elections/:electionId/candidates` |
| sacco | `GET /api/v1/sacco/elections/:electionId/candidates` | `GET /api/v1/elections/:electionId/candidates` |
| political | `GET /api/v1/political/elections/:electionId/candidates` | `GET /api/v1/elections/:electionId/candidates` |

| Org Type | Old URL | New URL |
|----------|---------|---------|
| school | `POST /api/v1/school/elections/:electionId/candidates` | `POST /api/v1/elections/:electionId/candidates` |
| church | `POST /api/v1/church/elections/:electionId/candidates` | `POST /api/v1/elections/:electionId/candidates` |
| sacco | `POST /api/v1/sacco/elections/:electionId/candidates` | `POST /api/v1/elections/:electionId/candidates` |
| political | `POST /api/v1/political/elections/:electionId/candidates` | `POST /api/v1/elections/:electionId/candidates` |

### 5. Results

| Org Type | Old URL | New URL |
|----------|---------|---------|
| school | `GET /api/v1/school/elections/:id/results` | `GET /api/v1/elections/:id/results` |
| church | `GET /api/v1/church/elections/:id/results` | `GET /api/v1/elections/:id/results` |
| sacco | `GET /api/v1/sacco/elections/:id/results` | `GET /api/v1/elections/:id/results` |
| political | `GET /api/v1/political/elections/:id/results` | `GET /api/v1/elections/:id/results` |

### 6. Audit Logs

| Org Type | Old URL | New URL |
|----------|---------|---------|
| school | `GET /api/v1/school/audit` | `GET /api/v1/audit` |
| church | `GET /api/v1/church/audit` | `GET /api/v1/audit` |
| sacco | `GET /api/v1/sacco/audit` | `GET /api/v1/audit` |
| political | `GET /api/v1/political/audit` | `GET /api/v1/audit` |

### 7. Dashboard

| Org Type | Old URL | New URL |
|----------|---------|---------|
| school | `GET /api/v1/school/dashboard` | `GET /api/v1/dashboard` |
| church | `GET /api/v1/church/dashboard` | `GET /api/v1/dashboard` |
| sacco | `GET /api/v1/sacco/dashboard` | `GET /api/v1/dashboard` |
| political | `GET /api/v1/political/dashboard` | `GET /api/v1/dashboard` |

### 8. Organizations (unchanged)

| URL | Description |
|-----|-------------|
| `GET /api/v1/organizations` | List all organizations |
| `GET /api/v1/organizations/:id` | Get organization by ID |
| `POST /api/v1/organizations` | Create organization |
| `PUT /api/v1/organizations/:id` | Update organization |

### 9. Authentication (unchanged)

| URL | Description |
|-----|-------------|
| `POST /api/v1/auth/login` | User login |
| `POST /api/v1/auth/refresh` | Refresh token |
| `POST /api/v1/auth/logout` | User logout |

## How It Works

### Old Behavior
1. Frontend sends request to `/api/v1/church/elections`
2. Backend looks up organization by `orgType` in URL
3. Returns data for that organization

**Problem**: Users could manipulate the URL to access other organizations' data

### New Behavior
1. Frontend sends request to `/api/v1/elections`
2. Backend extracts `organization.id` from the user's JWT token
3. Returns data only for the user's organization

**Benefit**: Users can only access their own organization's data - it's determined by their authentication, not the URL

## Frontend Changes Required

Replace all URL patterns in the frontend:

```javascript
// OLD - Do not use
const url = `/api/v1/${orgType}/elections`;
const url = `/api/v1/${orgType}/voters`;
const url = `/api/v1/${orgType}/vote`;

// NEW - Use these
const url = '/api/v1/elections';
const url = '/api/v1/voters';
const url = '/api/v1/vote';
```

Where `orgType` was one of: `school`, `church`, `sacco`, `political`

## What Stays the Same

- **Authentication**: No changes needed - JWT tokens work the same
- **Request Headers**: Authorization header unchanged
- **Request Body**: No changes to data format
- **Response Format**: Same JSON structure

## Ballot Question IDs

When creating or updating elections, ballot question IDs are now auto-generated by the backend if not provided:

```javascript
// Frontend can now omit the id field
{
  "title": "Who should be the Treasurer?",
  "type": "single",
  "options": ["Candidate A", "Candidate B", "Candidate C"]
}

// Backend generates: "question_1711308489000_1"
```

This prevents issues with hardcoded IDs like `church_q1`, `school_q1`, etc.