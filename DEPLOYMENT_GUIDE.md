# Complete Deployment & Configuration Guide

## Environment Variables Setup

Create a `.env.local` file in the project root with the following variables:

```env
# Authentication
JWT_SECRET=your_super_secret_jwt_key_min_32_chars_long

# Database (Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Blockchain
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
NEXT_PUBLIC_SEPOLIA_CHAIN_ID=11155111

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000
API_SECRET_KEY=your_api_secret_key

# Email Service (Optional - for production)
SENDGRID_API_KEY=your_sendgrid_key
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASSWORD=your_smtp_password

# Security
NEXT_PUBLIC_CORS_ORIGIN=http://localhost:3000,https://yourdomain.com

# Logging
LOG_LEVEL=debug
ENABLE_REQUEST_LOGGING=true
```

---

## Database Setup (Supabase)

### 1. Create Supabase Project
- Visit https://supabase.com
- Create new project
- Note your project URL and API keys

### 2. Run Database Schema
Execute the SQL from `/lib/database/schema.sql` in Supabase SQL editor:

```sql
-- All tables, RLS policies, and functions from schema.sql
```

### 3. Enable Row-Level Security (RLS)
All tables should have RLS enabled (already in schema):
- users_table
- identities_table
- credentials_table
- verification_requests_table
- policies_table
- organizations_table
- audit_logs_table

---

## Development Setup

### 1. Install Dependencies
```bash
npm install
# or
yarn install
```

### 2. Configure Environment
```bash
# Copy environment template
cp .env.example .env.local

# Edit with your values
nano .env.local
```

### 3. Run Development Server
```bash
npm run dev
```

Access at `http://localhost:3000`

### 4. Test Authentication
```bash
# Test register endpoint
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test123456!", "roles": ["owner"]}'

# Test login endpoint
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test123456!"}'
```

---

## Production Deployment

### Option 1: Deploy to Vercel

#### 1. Connect GitHub Repository
```bash
git remote add origin https://github.com/yourname/did-system.git
git push -u origin main
```

#### 2. Import to Vercel
- Visit https://vercel.com
- Click "New Project"
- Import your GitHub repository
- Configure build settings:
  - Framework: Next.js
  - Build Command: `npm run build`
  - Output Directory: `.next`

#### 3. Add Environment Variables
In Vercel Dashboard → Project Settings → Environment Variables:
```
JWT_SECRET: [your_secret]
NEXT_PUBLIC_SUPABASE_URL: [your_url]
NEXT_PUBLIC_SUPABASE_ANON_KEY: [your_key]
SUPABASE_SERVICE_ROLE_KEY: [your_key]
NEXT_PUBLIC_SEPOLIA_RPC_URL: [your_url]
NEXT_PUBLIC_API_URL: https://yourdomain.com
```

#### 4. Deploy
- Vercel automatically deploys on every push to main
- Monitor deployments in Vercel Dashboard

### Option 2: Deploy to AWS

#### 1. Prepare Application
```bash
npm run build
```

#### 2. Using Amplify (Recommended)
```bash
npm install -g @aws-amplify/cli
amplify configure
amplify init
amplify add hosting
amplify publish
```

#### 3. Using EC2
- Launch EC2 instance (Ubuntu 22.04)
- Install Node.js 18+
- Clone repository
- Install dependencies
- Set environment variables
- Run `npm run build`
- Use PM2 for process management:
```bash
npm install -g pm2
pm2 start "npm start" --name "did-app"
pm2 startup
pm2 save
```

### Option 3: Deploy to Docker

#### 1. Create Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

#### 2. Build & Run Locally
```bash
docker build -t did-system:latest .
docker run -p 3000:3000 \
  -e JWT_SECRET=your_secret \
  -e NEXT_PUBLIC_SUPABASE_URL=your_url \
  did-system:latest
```

#### 3. Push to Registry
```bash
docker tag did-system:latest yourusername/did-system:latest
docker push yourusername/did-system:latest
```

---

## Security Configuration

### 1. Enable HTTPS/SSL
- Use Let's Encrypt (free) or AWS Certificate Manager
- Redirect all HTTP to HTTPS

### 2. Configure CORS
Update `/lib/middleware/auth.ts`:
```typescript
const allowedOrigins = [
  'https://yourdomain.com',
  'https://www.yourdomain.com',
];
```

### 3. Setup Rate Limiting (Middleware)
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 4. Enable API Key Authentication (Optional)
Add to environment:
```env
API_KEY_REQUIRED=true
API_KEYS=key1,key2,key3
```

### 5. Setup Monitoring & Alerts
- Use Sentry for error tracking:
```bash
npm install @sentry/nextjs
```
- Configure in `next.config.mjs`
- Use DataDog or CloudWatch for metrics

---

## Database Backup Strategy

### 1. Supabase Automatic Backups
- Daily backups included in Pro plan
- 7-day retention
- Point-in-time recovery available

### 2. Manual Backups (PostgreSQL)
```bash
# Export database
pg_dump -h hostname -U username -d database_name > backup.sql

# Import database
psql -h hostname -U username -d database_name < backup.sql
```

### 3. Backup Schedule
- Daily automated snapshots
- Weekly full exports to S3
- Monthly backups retained for 1 year

---

## Performance Optimization

### 1. Enable Caching
```typescript
// Cache API responses
export const revalidate = 60; // 60 seconds
```

### 2. Add Redis Caching
```bash
npm install redis
```

### 3. Optimize Database Queries
- Add indexes on frequently queried columns
- Use connection pooling
- Implement query optimization

### 4. CDN Setup
- Use Vercel's built-in Edge Network
- Or configure CloudFront (AWS)
- Cache static assets with long TTLs

---

## Monitoring & Logging

### 1. Application Monitoring
```typescript
// Add to main API handler
console.log(`[${new Date().toISOString()}] ${method} ${url}`);
```

### 2. Error Tracking (Sentry)
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.captureException(error);
```

### 3. Performance Monitoring
- Use Vercel Analytics
- Monitor API response times
- Track database query performance

### 4. Log Aggregation
- Use CloudWatch (AWS)
- Or LogRocket for frontend errors
- Or ELK Stack for on-premise

---

## CI/CD Pipeline Setup

### GitHub Actions (Recommended)
Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm run lint
      - uses: vercel/action@master
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

## Troubleshooting

### Issue: "JWT_SECRET not defined"
**Solution:**
```bash
# Add to .env.local
JWT_SECRET=your_secret_key_here

# Verify it's loaded
echo $JWT_SECRET
```

### Issue: "Supabase connection error"
**Solution:**
```bash
# Check database URL format
# Should be: postgresql://user:password@host:port/database

# Test connection
psql "postgresql://user:password@host:port/database"
```

### Issue: "CORS error on API calls"
**Solution:**
```javascript
// Add to API route
const response = new Response(data);
response.headers.set('Access-Control-Allow-Origin', '*');
response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
```

### Issue: "Token validation fails"
**Solution:**
```bash
# Verify JWT secret is consistent
# Check token format: Bearer <token>
# Check token not expired

# Debug token
echo "Token: $(curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN" 2>&1)"
```

---

## Maintenance & Updates

### Regular Tasks
- **Weekly**: Review error logs, check performance metrics
- **Monthly**: Review security logs, update dependencies
- **Quarterly**: Security audit, database optimization
- **Yearly**: Full system review, capacity planning

### Update Procedure
```bash
# Update dependencies
npm update

# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Test thoroughly
npm run test

# Deploy
git push origin main
```

---

## Scaling Considerations

As your application grows:

1. **Database Scaling**
   - Upgrade Supabase tier
   - Implement read replicas
   - Add connection pooling

2. **API Scaling**
   - Implement caching layer
   - Use CDN for static assets
   - Horizontal scaling with load balancer

3. **Storage Scaling**
   - Use cloud storage (S3) for large files
   - Implement data archival strategy
   - Regular cleanup of old logs

4. **Monitoring Scaling**
   - Implement metrics dashboard
   - Set up automated alerts
   - Regular capacity planning reviews

---

## Cost Optimization

### Estimated Monthly Costs

**Development:**
- Supabase (Free tier): $0
- Vercel (Hobby): $0
- Domain: $10-12

**Production:**
- Supabase (Pro): $25
- Vercel (Pro): $20
- Domain: $12-15
- Monitoring (optional): $20-50
- **Total: ~$75-100/month**

### Cost Reduction Tips
- Use Supabase free tier for development
- Monitor API calls and database queries
- Implement caching to reduce database hits
- Use spot instances for batch jobs

---

## Support & Help

- **Documentation**: `/API_DOCUMENTATION.md`
- **Architecture**: `/ARCHITECTURE_DIAGRAMS.md`
- **Quick Start**: `/QUICK_START.md`
- **Issues**: Check GitHub issues
- **Community**: Check Supabase/Vercel communities

---

## Security Checklist

Before Production:
- [ ] JWT_SECRET is strong (32+ chars)
- [ ] HTTPS/SSL enabled
- [ ] Database backups tested
- [ ] CORS configured properly
- [ ] Error logging sanitized
- [ ] Rate limiting enabled
- [ ] Input validation complete
- [ ] Authorization checks in place
- [ ] Audit logging enabled
- [ ] Security headers configured
- [ ] Dependencies updated
- [ ] Security audit completed
