# HubSpot User Creator - Setup Guide

## Environment Configuration

Create a `.env.local` file in the root directory with your HubSpot API credentials:

```env
HUBSPOT_ACCESS_TOKEN=your_hubspot_private_app_access_token_here
```

## Getting Your HubSpot Access Token

1. Log into your HubSpot account
2. Go to Settings > Integrations > Private Apps
3. Create a new Private App or use an existing one
4. Under "Scopes", ensure you have these permissions:
   - `contacts` (Read and Write)
   - `companies` (Read)
5. Copy the Access Token and add it to your `.env.local` file

## Required HubSpot Custom Properties

Ensure your HubSpot account has a custom contact property called `active_in_okta` (checkbox/boolean type).

If this property doesn't exist, create it in HubSpot:
1. Go to Settings > Properties > Contact Properties
2. Create a new property with:
   - Name: `active_in_okta`
   - Label: `Active in Okta`
   - Field type: Single checkbox

## Important: Disable Automatic Company Creation

⚠️ **CRITICAL**: To prevent HubSpot from automatically creating companies based on email domains, you must configure the following settings in your HubSpot account:

### Option 1: Disable Automatic Company Creation (Recommended)
1. Go to **Settings > Objects > Companies**
2. Click **Company creation** 
3. **Uncheck** "Automatically create and associate companies"
4. **Uncheck** "Create companies from contact email domains"

### Option 2: Configure Company Creation Rules (Alternative)
1. Go to **Settings > Objects > Companies**  
2. Click **Company creation**
3. Set rules to only create companies when specific conditions are met
4. Ensure email domain matching is disabled

### Why This Matters:
Without these settings, HubSpot will automatically:
- Create new companies based on contact email domains (e.g., user@domain.com → "domain.com" company)
- Associate contacts to these auto-created companies
- Override the manual organization associations set by this application

**Note**: The application includes code to prevent automatic associations, but HubSpot's automatic company creation happens at the platform level and requires administrative configuration to fully disable.

## Running the Application

```bash
npm run dev
```

The application will be available at `http://localhost:3000`
