# ShulePal: Secure E-Voting API for Schools

ShulePal is a robust, production-ready backend built for high-integrity school elections. It features a modern tech stack centered on security, real-time monitoring, and a comprehensive audit trail.

---

## 🚀 Key Features

- **Dynamic Election Management**: Multi-position election support with real-time status controls.
- **Position-Based Results**: Advanced aggregation to provide detailed vote counts and percentages for each leadership role.
- **Cloudinary Image Integration**: Secure, cloud-based storage for candidate profile pictures.
- **Full Audit Trail**: Detailed logging for every critical action (logins, votes cast, candidate CRUD) to ensure election integrity.
- **Voter Session Security**: JWT-based authentication with organization-level isolation.
- **CSV Data Ingestion**: Bulk-upload thousands of voters via easy CSV imports.

---

## 🛠 Tech Stack

- **Runtime**: Node.js (TypeScript)
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose)
- **Storage**: Cloudinary (for profile pictures)
- **Auth**: JWT (jsonwebtoken) & Bcryptjs
- **Validation**: Zod (for type-safe request validation)

---

## 🏁 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- MongoDB (Atlas or Local)
- Cloudinary Account (for image uploads)

### 2. Installation
```bash
git clone https://github.com/Moses-Githinji/vote-verse-craft-api.git
cd vote-verse-craft-api
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory:
```env
PORT=4000
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=1h

# Cloudinary Config
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 4. Running the App
```bash
# Development
npm run dev

# Build & Production
npm run build
npm start
```

---

## 📊 API Summary

### Authentication
| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/api/v1/:orgType/voters/login` | POST | Public | Voter login using admission number |
| `/api/v1/auth/login` | POST | Public | Admin login |

### Elections & Candidates
| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/api/v1/:orgType/elections` | GET | Admin | List all elections for an org |
| `/api/v1/:orgType/elections/:id` | GET | All | Get detailed election info |
| `/api/v1/:orgType/elections/:id/candidates` | GET | All | List all candidates for an election |
| `/api/v1/:orgType/elections/:id/results` | GET | All | Get position-based election results |

### Voting
| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/api/v1/:orgType/vote` | POST | Voter | Cast a ballot with position-level votes |

### Audit Log (Security)
| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/api/v1/:orgType/audit` | GET | Admin | View the full audit trail of election actions |

---

## 🧩 Data Structures

### Voter Ballot Sample
When casting a vote, the positions are dynamically keyed to the election requirements:
```json
{
  "electionId": "65f...",
  "votes": {
    "president": "CANDIDATE_ID_1",
    "secretary": "CANDIDATE_ID_2",
    "sports_captain": "CANDIDATE_ID_3"
  }
}
```

---

## 🛡 Security & Audit
To ensure absolute transparency, every `vote_cast` and `login` event is logged in the `AuditLog` collection. Admins can verify exactly how many votes were cast, from which IP addresses, and at what timestamps.

---

## 📄 License
This project is licensed under the MIT License.
