# ZeroHuman Observability UI

A modern, select.dev-inspired observability platform built with Next.js, TypeScript, and Tailwind CSS.

## Features

- 🎨 **Modern UI**: Clean, neutral design inspired by select.dev
- 🌙 **Dark Mode**: System-aware theming with manual toggle
- 🔐 **Authentication**: Complete user management with signup, signin, and password reset
- 📊 **Real-time Dashboard**: KPI cards, charts, and workload monitoring
- 🔍 **Federated Search**: Search across all data assets with filters
- 📈 **Analytics**: Trends, insights, and cost monitoring
- 🔗 **Connectors**: Support for Snowflake, PostgreSQL, MySQL, and more
- 🤖 **Rule Agent**: Automated alerts and actions via Slack/webhooks
- 👥 **User Management**: Role-based access control and team management
- 🐳 **Docker Ready**: Containerized deployment with Docker Compose

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **Tables**: TanStack Table
- **Forms**: React Hook Form + Zod
- **State**: React Query
- **Icons**: Lucide React

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

### Docker

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or build Docker image
docker build -t thirdeye-ui .
docker run -p 3000:3000 thirdeye-ui
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (app)/             # Main application routes
│   │   ├── explore/       # Search and discovery
│   │   ├── insights/      # Analytics and trends
│   │   ├── rule-agent/    # Automated rules
│   │   └── settings/      # Configuration
│   ├── api/               # API routes
│   └── layout.tsx         # Root layout
├── components/
│   ├── chrome/            # App shell components
│   ├── data/              # Data visualization
│   └── ui/                # Reusable UI components
├── lib/
│   ├── teClient.ts        # ThirdEye API client
│   └── utils.ts           # Utility functions
└── hooks/                 # Custom React hooks
```

## Configuration

### Environment Variables

Create a `.env.local` file:

```env
# ZeroHuman Configuration
ZEROHUMAN_BASE_URL=https://api.zerohuman.example.com
NEXT_PUBLIC_APP_NAME=ZeroHuman Observability UI

# OpenMetadata Backend Integration
OPENMETADATA_BASE_URL=http://localhost:8585

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-key-change-this-in-production

# Email Configuration (for production)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### Authentication Setup

The application integrates with OpenMetadata backend for authentication:

1. **Sign In**: Login with your OpenMetadata credentials
2. **Backend Integration**: Connects to OpenMetadata API on localhost:8585
3. **Token Management**: Secure JWT and access token handling
4. **User Profiles**: Sync with OpenMetadata user data

**OpenMetadata Credentials:**
Use your existing OpenMetadata account credentials. If you don't have an account, contact your OpenMetadata administrator.

### Connection Setup

1. Click "Setup Connection" in the top bar
2. Enter your ZeroHuman API base URL and token
3. Test the connection to verify it works

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript checks

## Deployment

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-org/thirdeye-ui)

### Docker

```bash
# Build image
docker build -t thirdeye-ui .

# Run container
docker run -p 3000:3000 \
  -e THIRDEYE_BASE_URL=https://your-api.com \
  thirdeye-ui
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: thirdeye-ui
spec:
  replicas: 3
  selector:
    matchLabels:
      app: thirdeye-ui
  template:
    metadata:
      labels:
        app: thirdeye-ui
    spec:
      containers:
      - name: thirdeye-ui
        image: thirdeye-ui:latest
        ports:
        - containerPort: 3000
        env:
        - name: THIRDEYE_BASE_URL
          value: "https://your-api.com"
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

© 2024 ThirdEye. All rights reserved.

## Support

For support and questions:
- 📧 Email: support@thirdeye.com
- 📖 Documentation: [docs.thirdeye.com](https://docs.thirdeye.com)
- 🐛 Issues: [GitHub Issues](https://github.com/your-org/thirdeye-ui/issues)