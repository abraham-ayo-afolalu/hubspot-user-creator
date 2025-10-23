'use client';

import { useState } from 'react';
import { Upload, Download, CheckCircle, AlertCircle, Loader2, Users, Building2 } from 'lucide-react';

interface CsvUser {
  firstName: string;
  lastName: string;
  email: string;
}

interface OrganizationMatch {
  id: string;
  properties: {
    name: string;
    domain?: string;
  };
  similarity?: number;
}

interface BulkUploadResult {
  success: boolean;
  total: number;
  successful: number;
  failed: number;
  errors: Array<{
    row: number;
    user: CsvUser;
    error: string;
  }>;
}

export default function BulkUploadForm() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CsvUser[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState<OrganizationMatch | null>(null);
  const [organizationMatches, setOrganizationMatches] = useState<OrganizationMatch[]>([]);
  const [organizationSearch, setOrganizationSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(null);

  // Handle CSV file selection and parsing
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsedData = parseCSV(text);
      setCsvData(parsedData);
    };
    
    reader.readAsText(file);
  };

  // Parse CSV content
  const parseCSV = (text: string): CsvUser[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    // Assume first line is header, skip it
    const dataLines = lines.slice(1);
    
    return dataLines.map((line, index) => {
      const columns = line.split(',').map(col => col.trim().replace(/"/g, ''));
      return {
        firstName: columns[0] || '',
        lastName: columns[1] || '',
        email: columns[2] || '',
      };
    }).filter(user => user.firstName && user.lastName && user.email);
  };

  // Search for organizations
  const searchOrganizations = async () => {
    if (!organizationSearch.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch('/api/search-organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ organizationName: organizationSearch }),
      });

      const data = await res.json();
      if (data.success) {
        setOrganizationMatches(data.matches);
      }
    } catch (error) {
      console.error('Error searching organizations:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle bulk upload
  const handleBulkUpload = async () => {
    if (!selectedOrganization || csvData.length === 0) return;

    setIsUploading(true);
    setUploadResult(null);

    try {
      const res = await fetch('/api/bulk-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          users: csvData,
          organizationId: selectedOrganization.id,
          organizationName: selectedOrganization.properties.name,
        }),
      });

      const result: BulkUploadResult = await res.json();
      setUploadResult(result);
    } catch (error) {
      setUploadResult({
        success: false,
        total: csvData.length,
        successful: 0,
        failed: csvData.length,
        errors: [{ row: 0, user: csvData[0], error: 'Upload failed' }],
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Download sample CSV template
  const downloadTemplate = () => {
    const csvContent = 'firstName,lastName,email\nJohn,Doe,john.doe@example.com\nJane,Smith,jane.smith@example.com';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_upload_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Download Template */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-blue-800">CSV Template</h3>
            <p className="text-sm text-blue-600">Download the template to format your data correctly</p>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Template
          </button>
        </div>
      </div>

      {/* File Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Upload className="inline w-4 h-4 mr-1" />
          Upload CSV File
        </label>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
        />
        {selectedFile && (
          <p className="mt-2 text-sm text-gray-600">
            Selected: {selectedFile.name} ({csvData.length} users)
          </p>
        )}
      </div>

      {/* CSV Preview */}
      {csvData.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            <Users className="inline w-4 h-4 mr-1" />
            Preview ({csvData.length} users)
          </h3>
          <div className="max-h-40 overflow-auto border border-gray-200 rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">First Name</th>
                  <th className="px-3 py-2 text-left">Last Name</th>
                  <th className="px-3 py-2 text-left">Email</th>
                </tr>
              </thead>
              <tbody>
                {csvData.slice(0, 5).map((user, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-3 py-2">{user.firstName}</td>
                    <td className="px-3 py-2">{user.lastName}</td>
                    <td className="px-3 py-2">{user.email}</td>
                  </tr>
                ))}
                {csvData.length > 5 && (
                  <tr className="border-t">
                    <td colSpan={3} className="px-3 py-2 text-gray-500 italic">
                      ... and {csvData.length - 5} more users
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Organization Selection */}
      {csvData.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Building2 className="inline w-4 h-4 mr-1" />
            Select Organization
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={organizationSearch}
              onChange={(e) => setOrganizationSearch(e.target.value)}
              placeholder="Search for organization..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={searchOrganizations}
              disabled={!organizationSearch.trim() || isSearching}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </button>
          </div>

          {/* Organization Matches */}
          {organizationMatches.length > 0 && (
            <div className="mt-3 space-y-2">
              {organizationMatches.map((match) => (
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
                    <span className="font-medium">{match.properties.name}</span>
                    <span className="text-xs text-gray-500">
                      {Math.round((match.similarity || 0) * 100)}% match
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedOrganization && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">
                Selected: <strong>{selectedOrganization.properties.name}</strong>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Upload Button */}
      {csvData.length > 0 && selectedOrganization && (
        <button
          onClick={handleBulkUpload}
          disabled={isUploading}
          className="w-full flex justify-center items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {isUploading ? (
            <>
              <Loader2 className="animate-spin w-4 h-4 mr-2" />
              Uploading Users...
            </>
          ) : (
            `Upload ${csvData.length} Users to ${selectedOrganization.properties.name}`
          )}
        </button>
      )}

      {/* Upload Results */}
      {uploadResult && (
        <div className={`p-4 rounded-md ${uploadResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-start">
            {uploadResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 mr-2 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" />
            )}
            <div className="flex-1">
              <h3 className={`text-sm font-medium ${uploadResult.success ? 'text-green-800' : 'text-red-800'}`}>
                Bulk Upload Complete
              </h3>
              <div className="mt-2 text-sm">
                <p>Total: {uploadResult.total}</p>
                <p className="text-green-600">Successful: {uploadResult.successful}</p>
                {uploadResult.failed > 0 && (
                  <p className="text-red-600">Failed: {uploadResult.failed}</p>
                )}
              </div>

              {uploadResult.errors.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-sm font-medium text-red-800">Errors:</h4>
                  <ul className="mt-1 text-sm text-red-700 space-y-1">
                    {uploadResult.errors.slice(0, 5).map((error, index) => (
                      <li key={index}>
                        Row {error.row + 1}: {error.user.firstName} {error.user.lastName} - {error.error}
                      </li>
                    ))}
                    {uploadResult.errors.length > 5 && (
                      <li>... and {uploadResult.errors.length - 5} more errors</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
