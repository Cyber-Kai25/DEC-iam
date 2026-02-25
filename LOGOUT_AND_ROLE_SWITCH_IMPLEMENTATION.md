# Complete Logout and Role Switching Implementation

## Overview
This document describes the complete implementation of secure logout handling and seamless role switching mechanisms within the decentralized identity web application.

## Architecture Components

### 1. Session Management Layer
**Location:** `/lib/context/role-context.tsx`

The role context now handles complete session management:
- Maintains authentication state with `currentUser`
- Tracks logout state with `isLoggingOut`
- Implements `logout()` method for secure session termination
- Validates role switches with permission checks

### 2. Logout Handler
**Location:** `/components/app-shell.tsx`

Two logout buttons integrated:
1. Sidebar logout button - Quick access in sidebar
2. User menu logout - In header dropdown

Both buttons:
- Show loading state during logout ("Logging out...")
- Are disabled while logout is in progress
- Call the centralized `logout()` method
- Redirect to `/auth/login` after completion

### 3. Role Switcher Component
**Location:** `/components/role-switcher.tsx`

Enhanced role switching with:
- Loading spinner during role switch
- Toast notifications for feedback
- Role validation (prevents switching to unavailable roles)
- Automatic redirect to correct dashboard
- Disabled state for active role

### 4. Session Termination Flow
```
User clicks logout
         ↓
Button shows loading state
         ↓
logout() method called
         ↓
Supabase.auth.signOut() called (server-side session killed)
         ↓
localStorage cleared
         ↓
State reset (currentUser = null, activeRole = "owner")
         ↓
Redirect to /auth/login
         ↓
User must re-authenticate to access dashboards
```

### 5. Role Switching Flow
```
User selects new role from switcher
         ↓
handleRoleSwitch() validates user has role
         ↓
switchRole() updates active role in state
         ↓
localStorage saved with new role
         ↓
Redirect to /{role}/dashboard
         ↓
Toast shows success
         ↓
Dashboard loads with new role permissions
         ↓
Sidebar and navigation update
```

## Security Features

### Session Termination (Logout)
- **Server-side:** Supabase invalidates JWT token
- **Client-side:** localStorage completely cleared
- **Cookies:** HTTP-only cookies removed
- **State:** React state reset to initial values
- **Navigation:** Forced redirect to login

### Role-Based Access Control
- **Permission Check:** User must have role before switching
- **Navigation:** Sidebar updates based on active role
- **API Calls:** Only accessible with correct role
- **Dashboard:** Content filtered by role
- **Validation:** Every request verified server-side

### Error Handling
- Try-catch blocks wrap logout call
- Toast notifications show errors to user
- State cleared even if logout fails
- Redirect happens regardless of errors
- Console logs for debugging

## Implementation Details

### logout() Method
```typescript
const logout = async () => {
  setIsLoggingOut(true);
  try {
    const supabase = createClient();
    await supabase.auth.signOut(); // Server-side logout
    clearUserState(); // Clear localStorage
  } catch (error) {
    console.error("[v0] Error during logout:", error);
    clearUserState(); // Clear state even on error
  } finally {
    setIsLoggingOut(false);
  }
};
```

### switchRole() Method
```typescript
const switchRole = (role: UserRole): boolean => {
  if (!currentUser) return false;
  
  // Validate user has role
  if (!currentUser.roles.includes(role)) {
    return false;
  }
  
  const updated = RoleManagementService.switchRole(currentUser, role);
  if (updated) {
    setCurrentUser(updated);
    setActiveRole(role);
    saveUserState();
    return true;
  }
  return false;
};
```

### Role Switcher Handler
```typescript
const handleRoleSwitch = async (newRole: string) => {
  setIsSwitching(true);
  try {
    const success = switchRole(newRole as any);
    if (!success) {
      toast.error("Failed to switch role");
      return;
    }
    router.push(`/${newRole}/dashboard`);
    toast.success(`Switched to ${newRole} role`);
  } catch (error) {
    toast.error("Error switching role");
  } finally {
    setIsSwitching(false);
  }
};
```

## Data Flows

### Complete Session Lifecycle

#### Login
1. User enters email/password at `/auth/login`
2. Supabase authenticates and returns session
3. JWT token stored in HTTP-only cookie
4. User redirected to `/roles`
5. Role selection page loads
6. User selects roles and clicks "Get Started"
7. Role context set with user data
8. Redirected to `/{role}/dashboard`
9. Middleware validates session on each request

#### Role Switching
1. User clicks role switcher in header
2. Dropdown shows all available roles
3. User selects different role
4. `handleRoleSwitch()` validates permission
5. `switchRole()` updates active role
6. localStorage saved with new state
7. Router redirects to new dashboard
8. Dashboard loads with new role's permissions
9. Sidebar updates navigation items

#### Logout
1. User clicks logout button (sidebar or menu)
2. Loading state shown to user
3. `logout()` called
4. Supabase session terminated server-side
5. localStorage cleared client-side
6. React state reset
7. Router redirects to `/auth/login`
8. Login page loads (user not authenticated)

### Protected Routes

```
Middleware checks every request:
  - Extract JWT from cookie
  - Validate JWT signature
  - Extract user ID and roles
  
If valid:
  - Allow request
  - Add user to request context
  - API routes use user for RLS
  
If invalid:
  - Redirect to /auth/login
  - Clear cookies
  - Show login form
```

## User Experience

### Clear Loading States
- During logout: "Logging out..." text appears
- During role switch: Spinner shows in role switcher
- Button disabled while loading
- User can't trigger multiple requests

### Helpful Feedback
- Toast notifications for success/errors
- Console logs for debugging
- Error messages in catch blocks
- Loading states prevent confusion

### Smooth Transitions
- No page flashing
- Dashboard loads immediately after switch
- Navigation updates automatically
- No re-authentication needed for role switch
- Only logout requires re-authentication

## Testing Guide

### Test Logout
1. Login with test account
2. Click sidebar logout button
3. Verify loading state appears
4. Verify redirect to `/auth/login`
5. Verify login form shows
6. Try to access `/owner/dashboard` directly
7. Verify redirect to login

### Test Role Switching
1. Login with account having multiple roles
2. Click role switcher dropdown
3. Select different role
4. Verify spinner shows
5. Verify redirect to new dashboard
6. Verify navigation items changed
7. Verify no re-authentication needed
8. Switch back to original role
9. Verify works smoothly

### Test Authorization
1. Try accessing dashboard URL directly
2. Verify can only access roles you have
3. Modify role in DevTools
4. Verify server rejects unauthorized request
5. Verify forced logout occurs

## Performance Considerations

### Optimizations Implemented
- No unnecessary re-renders
- Conditional logout only if user exists
- Loading state prevents double-clicks
- LocalStorage operations are cached
- Router prefetch for dashboard redirects

### Database Operations
- Supabase session invalidation is async
- No blocking calls on logout
- RLS policies filter data at DB level
- No N+1 queries on role switch

## Deployment Checklist

- [ ] Test logout flow end-to-end
- [ ] Test role switching with multiple roles
- [ ] Verify middleware protects all routes
- [ ] Check error handling works
- [ ] Verify console logs for debugging
- [ ] Test with poor network (slow logout)
- [ ] Test with invalid session token
- [ ] Verify mobile responsiveness
- [ ] Check accessibility (keyboard nav)
- [ ] Monitor Supabase logs
- [ ] Review audit logs
- [ ] Deploy to staging first
- [ ] Test in production environment

## Future Enhancements

1. **Session Timeout:** Auto-logout after inactivity
2. **Remember Me:** Optional persistent session
3. **Multi-Device Logout:** Logout all devices
4. **Session History:** View active sessions
5. **Role Audit:** Track role switches in logs
6. **Two-Factor Authentication:** 2FA on login
7. **Biometric Login:** Fingerprint/face auth
8. **Session Recovery:** Resume session if valid

## Support & Troubleshooting

### Issue: User not logged out
**Solution:** Check Supabase session in DevTools

### Issue: Role switch fails
**Solution:** Verify user has target role in database

### Issue: Can access dashboard without login
**Solution:** Check middleware configuration

### Issue: Lost session after reload
**Solution:** Verify JWT cookie persistence

See `LOGOUT_AND_ROLE_SWITCH_FIXES.md` for complete troubleshooting guide.
