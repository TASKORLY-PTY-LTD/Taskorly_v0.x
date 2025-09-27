# Development Test Accounts

## 🔐 Test Credentials for Development

Since the automatic seeding had database schema issues, here are the test account details you can
create manually using the signup form:

### **Owner Account (Full Admin Access)**

```
Email: owner@taskorly.dev
Password: DevOwner123!
Full Name: Alice Johnson
Company: Taskorly Demo Corp
Role: Business Owner
```

### **Admin Account**

```
Email: admin@taskorly.dev
Password: DevAdmin123!
Full Name: Bob Smith
Role: Admin (must be invited by owner)
```

### **Manager Account**

```
Email: manager@taskorly.dev
Password: DevManager123!
Full Name: Carol Wilson
Role: Manager (must be invited by admin/owner)
```

### **User Account**

```
Email: user@taskorly.dev
Password: DevUser123!
Full Name: David Brown
Role: User (must be invited by admin/owner)
```

## 📋 Testing Instructions

### Step 1: Create Owner Account

1. Go to http://localhost:3000
2. Click "Sign up"
3. Use the Owner Account credentials above
4. This will create the main tenant and give you full access

### Step 2: Test Login Flow

1. Use the Owner credentials to login
2. Verify you can access all features
3. Check role-based UI elements appear correctly

### Step 3: Test Different Roles (Optional)

To test other roles, you would need to:

1. Use the invitation system (once implemented)
2. Or manually create users via the admin interface

## 🎯 What to Test

### **Authentication Flow**

- ✅ Signup with owner role
- ✅ Login with email/password
- ✅ Session persistence across browser refresh
- ✅ Logout functionality

### **Role-Based Access**

- ✅ Owner can access all features
- ✅ Different UI elements based on permissions
- ✅ Protected routes work correctly

### **UI Components**

- ✅ Dashboard loads with user data
- ✅ Navigation sidebar shows appropriate options
- ✅ User profile information displays
- ✅ Permission guards hide/show content correctly

## 🚀 Quick Start

```bash
# 1. Make sure development server is running
npm run dev

# 2. Open browser to http://localhost:3000

# 3. Click "Sign up" and use Owner credentials above

# 4. Test the authentication flow
```

## ⚠️ Development Only

These accounts are for **DEVELOPMENT TESTING ONLY**:

- Never use these credentials in production
- All accounts use the `.dev` domain
- Passwords include development indicators
- Data will be reset between development cycles

## 🔧 Troubleshooting

If you encounter issues:

1. **tRPC Context Errors**: Already fixed with TRPCProvider
2. **Database Connection**: Check environment variables
3. **Signup Failures**: Check browser console for API errors
4. **Login Issues**: Verify credentials and check network tab

The authentication system is fully functional - you just need to create the first owner account
manually through the UI.
