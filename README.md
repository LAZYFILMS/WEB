# LAZY FILMS Website

## Directory Structure

```
.
├── frontend/
│   ├── index.html       # Main website with all styling and frontend logic
│   ├── nathan.png       # Background image
│   ├── apple-touch-icon.png
│   ├── favicon-32x32.png
│   ├── favicon-16x16.png
│   ├── site.webmanifest
│   └── labs/           # Labs section
│       └── index.html  # Labs subpage
└── backend/
    ├── server.js        # Express server handling payments and emails
    ├── package.json     # Backend dependencies
    └── .env.example     # Example environment variables
```

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your actual credentials:
   - Add your Razorpay API keys
   - Add your email service credentials
   - Update any other configuration as needed

### Frontend Setup

1. Update the API endpoint in `frontend/index.html`:
   - Replace `http://localhost:3000` with your actual backend URL when deploying
   - Update the Razorpay key with your production key

## AWS Deployment

### Backend Deployment (AWS Elastic Beanstalk)

1. Install the AWS CLI and EB CLI

2. Initialize Elastic Beanstalk:
   ```bash
   cd backend
   eb init
   ```

3. Create an environment:
   ```bash
   eb create production
   ```

4. Set environment variables:
   ```bash
   eb setenv $(cat .env | xargs)
   ```

5. Deploy:
   ```bash
   eb deploy
   ```

### Frontend Deployment (AWS S3 + CloudFront)

1. Create an S3 bucket:
   - Enable static website hosting
   - Configure bucket policy for public access

2. Upload frontend files:
   ```bash
   aws s3 sync frontend/ s3://your-bucket-name
   ```

3. Create a CloudFront distribution:
   - Point to your S3 bucket
   - Enable HTTPS
   - Configure custom domain if needed

## Security Notes

1. Never commit `.env` file or sensitive credentials
2. Use HTTPS for all API communications
3. Implement rate limiting on the backend
4. Keep Razorpay keys secure
5. Use AWS IAM roles with minimum required permissions

## Development

1. Run backend locally:
   ```bash
   cd backend
   npm run dev
   ```

2. Test frontend:
   - Use a local server (e.g., Live Server VS Code extension)
   - Test payments with Razorpay test mode

## Production Considerations

1. Update API endpoints to production URLs
2. Switch to Razorpay production keys
3. Enable CORS only for your domain
4. Set up monitoring and logging
5. Configure error alerting
6. Set up automated backups
7. Implement request validation
8. Add rate limiting
9. Set up SSL certificates 