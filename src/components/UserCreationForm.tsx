'use client';

import { useState } from 'react';
import { User, Building2, CheckCircle, AlertCircle, Loader2, Mail } from 'lucide-react';

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  organizationName: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  contactId?: string;
  companyId?: string;
}

interface OrganizationMatch {
  id: string;
  properties: {
    name: string;
    domain?: string;
  };
  similarity?: number;
}

interface SearchResponse {
  success: boolean;
  matches: OrganizationMatch[];
  searchTerm: string;
  message?: string;
}

export default function UserCreationForm() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    organizationName: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [organizationMatches, setOrganizationMatches] = useState<OrganizationMatch[]>([]);
  const [showOrganizationConfirmation, setShowOrganizationConfirmation] = useState(false);
  const [selectedOrganization, setSelectedOrganization] = useState<OrganizationMatch | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResponse(null);

    try {
      // First, search for organization matches
      const searchRes = await fetch('/api/search-organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ organizationName: formData.organizationName }),
      });

      const searchData = await searchRes.json();
      console.log('Search API response:', searchData);
      
      if (!searchData.success) {
        setResponse({
          success: false,
          message: searchData.error?.message || searchData.message || 'Failed to search organizations.',
        });
        return;
      }

      // Handle new API response format where data is wrapped in 'data' property
      const matches = searchData.data?.matches || searchData.matches || [];
      
      // If matches found, show confirmation dialog
      if (matches.length > 0) {
        setOrganizationMatches(matches);
        setShowOrganizationConfirmation(true);
      } else {
        // No matches found, show error message with support contact
        setResponse({
          success: false,
          message: `No organizations found matching "${formData.organizationName}". Please check the spelling and try again, or contact support at access@elasticpath.com for assistance.`,
        });
      }
    } catch (error) {
      console.error('Organization search error:', error);
      setResponse({
        success: false,
        message: `🔍 DEBUG: Organization search failed: ${error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createUser = async (organization: OrganizationMatch) => {
    console.log('createUser called with organization:', organization);
    
    if (!organization) {
      setResponse({
        success: false,
        message: 'An organization must be selected to create a user.',
      });
      return;
    }
    
    setIsLoading(true);
    
    const requestData = {
      ...formData,
      companyId: organization.id,
      companyName: organization.properties.name,
    };
    
    console.log('Sending request to /api/create-user with data:', requestData);
    
    try {
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      console.log('Response status:', res.status, res.statusText);

      if (!res.ok) {
        console.log('Response not OK, trying to get error details...');
        // Try to get error details from response
        try {
          const errorData = await res.json();
          console.log('Error data from response:', errorData);
          
          // Handle specific error types with user-friendly messages
          let userMessage = errorData.error?.message || errorData.message || `HTTP ${res.status}: ${res.statusText}`;
          
          if (errorData.error?.code === 'USER_ALREADY_EXISTS' || res.status === 409) {
            userMessage = `A user with the email "${formData.email}" already exists. Please use a different email address or contact support at access@elasticpath.com if this is unexpected.`;
          } else if (errorData.error?.code === 'AUTHENTICATION_ERROR') {
            userMessage = 'HubSpot integration is not properly configured. Please contact your administrator.';
          } else if (errorData.error?.code === 'RATE_LIMIT_EXCEEDED') {
            userMessage = 'Too many requests. Please wait a moment and try again.';
          } else if (errorData.error?.code === 'VALIDATION_ERROR') {
            userMessage = `Validation failed: ${errorData.error.message}`;
          }
          
          setResponse({
            success: false,
            message: userMessage,
          });
        } catch (parseError) {
          console.log('Failed to parse error response:', parseError);
          setResponse({
            success: false,
            message: `Server error (${res.status}): ${res.statusText}. Please try again or contact support.`,
          });
        }
        return;
      }

      const data: ApiResponse = await res.json();
      console.log('Success response data:', data);
      setResponse(data);

      if (data.success) {
        setFormData({ firstName: '', lastName: '', email: '', organizationName: '' });
        setShowOrganizationConfirmation(false);
        setOrganizationMatches([]);
        setSelectedOrganization(null);
      }
    } catch (error) {
      console.error('Create user error:', error);
      setResponse({
        success: false,
        message: `🔍 DEBUG: Network error caught in frontend: ${error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = formData.firstName.trim() && formData.lastName.trim() && formData.email.trim() && formData.organizationName.trim();

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
            <User className="inline w-4 h-4 mr-1" />
            First Name
          </label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            value={formData.firstName}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
            placeholder="Enter first name"
          />
        </div>

        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
            <User className="inline w-4 h-4 mr-1" />
            Last Name
          </label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            value={formData.lastName}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
            placeholder="Enter last name"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            <Mail className="inline w-4 h-4 mr-1" />
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
            placeholder="Enter email address"
          />
        </div>

        <div>
          <label htmlFor="organizationName" className="block text-sm font-medium text-gray-700 mb-2">
            <Building2 className="inline w-4 h-4 mr-1" />
            Organization Name
          </label>
          <input
            type="text"
            id="organizationName"
            name="organizationName"
            value={formData.organizationName}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
            placeholder="Enter organization name"
          />
        </div>

        <button
          type="submit"
          disabled={!isFormValid || isLoading}
          className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin w-4 h-4 mr-2" />
              Creating User...
            </>
          ) : (
            'Create User'
          )}
        </button>
      </form>

      {showOrganizationConfirmation && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h3 className="text-sm font-medium text-blue-800 mb-3">
            Please select the correct organization from the options below:
          </h3>
          <div className="space-y-2 mb-4">
            {organizationMatches.map((match, index) => (
              <button
                key={match.id}
                onClick={() => setSelectedOrganization(match)}
                className={`w-full text-left p-3 rounded-md border transition-colors ${
                  selectedOrganization?.id === match.id
                    ? 'border-blue-500 bg-blue-100'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">{match.properties.name}</span>
                </div>
                {match.properties.domain && (
                  <span className="text-sm text-gray-700">{match.properties.domain}</span>
                )}
              </button>
            ))}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => selectedOrganization && createUser(selectedOrganization)}
              disabled={!selectedOrganization || isLoading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin w-4 h-4 mr-2 inline" />
                  Creating...
                </>
              ) : (
                'Create User with Selected Organization'
              )}
            </button>
            <button
              onClick={() => {
                setShowOrganizationConfirmation(false);
                setOrganizationMatches([]);
                setSelectedOrganization(null);
                setResponse({
                  success: false,
                  message: `No suitable organization found for "${formData.organizationName}". Please check the spelling and try again, or contact support at access@elasticpath.com for assistance adding a new organization.`,
                });
              }}
              disabled={isLoading}
              className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel & Try Again
            </button>
          </div>
        </div>
      )}

      {response && (
        <div className={`mt-6 p-4 rounded-md ${response.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-start">
            {response.success ? (
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 mr-2 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className={`text-sm font-medium ${response.success ? 'text-green-800' : 'text-red-800'}`}>
                {response.success ? 'User Created Successfully!' : 'Error'}
              </p>
              {response.success ? (
                <div className="mt-2 space-y-3">
                  <p className="text-sm text-green-700">
                    {response.message}
                  </p>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <h4 className="text-sm font-semibold text-blue-800 mb-2">Next Steps:</h4>
                    <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                      <li>The user will receive an activation email from <strong>access@elasticpath.com</strong></li>
                      <li>They should check their email for a welcome message</li>
                      <li>Click the <strong>Activate</strong> link at the bottom of the email</li>
                      <li>Set up a password for their account</li>
                      <li>Once activated, they can access Elastic Path resources at:</li>
                    </ol>
                    <div className="mt-2 p-2 bg-white border border-blue-300 rounded">
                      <a 
                        href="https://elasticpath-customer.okta.com/app/UserHome" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 underline break-all"
                      >
                        https://elasticpath-customer.okta.com/app/UserHome
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <p className={`text-sm mt-1 text-red-700`}>
                  {response.message}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
