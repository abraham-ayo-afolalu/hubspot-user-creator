import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@hubspot/api-client';
import { 
  createErrorResponse, 
  createSuccessResponse,
  logError
} from '@/lib/errorHandler';

const hubspotClient = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substr(2, 9);
  
  try {
    if (!process.env.HUBSPOT_ACCESS_TOKEN) {
      return createErrorResponse(new Error('HubSpot access token not configured'), requestId);
    }

    const body = await request.json();
    const { contactId, action } = body;

    if (!contactId) {
      return createErrorResponse(new Error('Contact ID is required'), requestId);
    }

    if (action === 'check') {
      // Check what company associations exist for this contact
      try {
        const contact = await hubspotClient.crm.contacts.basicApi.getById(contactId, ['email', 'firstname', 'lastname']);
        
        // This is a simplified approach - in a real implementation you'd need to:
        // 1. Get contact's company associations 
        // 2. Check if they're automatically created vs manually assigned
        // 3. Provide details about each association
        
        return createSuccessResponse({
          contactId,
          contactInfo: {
            email: contact.properties.email,
            name: `${contact.properties.firstname} ${contact.properties.lastname}`
          },
          message: 'Use HubSpot UI to manually check and remove unwanted company associations',
          instructions: [
            '1. Go to HubSpot Contacts',
            '2. Search for the contact by email or name',
            '3. Check the "Associated Companies" section',
            '4. Remove any automatically created companies (usually named after email domains)',
            '5. Keep only the intended organization association'
          ]
        }, 'Contact information retrieved');

      } catch (error) {
        logError(error as Error, { requestId, contactId });
        return createErrorResponse(error as Error, requestId);
      }
    }

    return createErrorResponse(new Error('Invalid action. Use "check" to inspect contact associations.'), requestId);

  } catch (error: any) {
    logError(error, { requestId });
    return createErrorResponse(error, requestId);
  }
}
