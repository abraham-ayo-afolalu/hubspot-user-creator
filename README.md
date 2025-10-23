# HubSpot User Creator

A modern web application built with Next.js for creating users in HubSpot with intelligent organization matching.

## Features

- **User Creation**: Create contacts in HubSpot with first name, last name, and organization
- **Smart Organization Matching**: Automatically finds the closest matching organization in HubSpot
- **Active in Okta Field**: Automatically sets the `active_in_okta` custom field to true
- **Modern UI**: Clean, responsive interface built with Tailwind CSS
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Real-time Feedback**: Loading states and success/error notifications

## Prerequisites

- Node.js 18+ installed
- HubSpot account with API access
- HubSpot Private App with the following scopes:
  - `contacts` (Read and Write)
  - `companies` (Read)

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
npm install
```

### 2. HubSpot Configuration

1. **Create a Private App in HubSpot:**
   - Go to Settings > Integrations > Private Apps
   - Click "Create a private app"
   - Add the required scopes: `contacts` (Read/Write) and `companies` (Read)
   - Generate the access token

2. **Create Custom Property:**
   - Go to Settings > Properties > Contact Properties
   - Create a new property:
     - Name: `active_in_okta`
     - Label: `Active in Okta`
     - Field type: Single checkbox (boolean)

### 3. Environment Variables

Create a `.env.local` file in the root directory:

```env
HUBSPOT_ACCESS_TOKEN=your_hubspot_private_app_access_token_here
```

### 4. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

## How It Works

1. **User Input**: Enter the user's first name, last name, and organization name
2. **Organization Matching**: The app searches HubSpot companies and uses intelligent matching:
   - Exact name matches get highest priority
   - Prefix matches receive high scores
   - Fuzzy string matching with Levenshtein distance
   - Company name normalization (removes common suffixes like Inc., Corp., etc.)
   - Only matches with 60%+ similarity are considered
3. **Contact Creation**: Creates a new contact in HubSpot with:
   - First and last name
   - `active_in_okta` field set to true
   - Association with the matched company (noted in contact notes)

## Project Structure

```
src/
├── app/
│   ├── api/create-user/route.ts    # API endpoint for user creation
│   └── page.tsx                    # Main application page
├── components/
│   └── UserCreationForm.tsx        # Form component
└── lib/
    └── utils.ts                    # Utility functions for string matching
```

## API Endpoints

### POST `/api/create-user`

Creates a new contact in HubSpot.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "organizationName": "Acme Corporation"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User created successfully...",
  "contactId": "12345",
  "companyId": "67890"
}
```

## Technologies Used

- **Next.js 15**: React framework with App Router
- **TypeScript**: Type safety and better development experience
- **Tailwind CSS**: Utility-first CSS framework
- **HubSpot API Client**: Official HubSpot Node.js client
- **Lucide React**: Beautiful, customizable icons

## Error Handling

The application handles various error scenarios:
- Missing or invalid HubSpot access token
- Network connectivity issues
- HubSpot API rate limits
- Duplicate contact creation
- Invalid form input

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
