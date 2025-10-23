# Admin Authentication

## Current Admin Credentials (Development Only)

**Username:** `admin`  
**Password:** `111111`

## Security Notes

⚠️ **WARNING**: These are development-only credentials. For production deployment:

1. **Change the credentials** in `/src/lib/auth.ts`
2. **Use environment variables** instead of hardcoded values
3. **Implement stronger password requirements**
4. **Add password hashing** (bcrypt, etc.)
5. **Consider OAuth/SSO integration**

## How Authentication Works

1. **Main App**: Now publicly accessible at `/` (no login required)
2. **Admin Panel**: Protected at `/admin` (requires login)
3. **Login**: Available at `/admin/login` with username/password
4. **Session**: JWT token stored in HTTP-only cookie (8-hour expiration)
5. **Protected Routes**: Only `/admin/*` routes require authentication
6. **Logout**: Available in admin panel header

## Application Structure

### **Public Access (No Authentication Required):**
- `/` - Main HubSpot User Creator application
- `/api/create-user` - Single user creation
- `/api/bulk-upload` - Bulk user upload  
- `/api/search-organizations` - Organization search

### **Admin Access (Authentication Required):**
- `/admin` - Admin dashboard with audit logs and statistics
- `/admin/login` - Admin login page
- `/api/admin/*` - Admin API endpoints

## Usage

### **For Regular Users:**
1. Navigate to `/` 
2. Use the HubSpot User Creator directly (no login needed)

### **For Administrators:**
1. Navigate directly to `/admin` (no button visible on main page)
2. Login with: `admin` / `111111`
3. View audit logs, statistics, and system monitoring
4. Click "Logout" when done
5. Click "Main App" to return to the public interface

## Development Notes

The authentication system includes:
- JWT token validation for admin routes only
- Middleware protection for `/admin/*` routes
- Secure cookie handling
- Admin dashboard with audit logging
- Error handling and session management
- Public access to main functionality
